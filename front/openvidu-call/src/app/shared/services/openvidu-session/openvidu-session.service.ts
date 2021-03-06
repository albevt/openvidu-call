import { Injectable } from '@angular/core';
import { UserModel } from '../../models/user-model';
import { OpenVidu, PublisherProperties, Publisher, Session } from 'openvidu-browser';
import { BehaviorSubject, Observable } from 'rxjs';
import { ScreenType } from '../../types/video-type';
import { AvatarType } from '../../types/chat-type';
import { LoggerService } from '../logger/logger.service';
import { ILogger } from '../../types/logger-type';

@Injectable({
	providedIn: 'root'
})
export class OpenViduSessionService {

	OVUsers: Observable<UserModel[]>;
	private _OVUsers = <BehaviorSubject<UserModel[]>>new BehaviorSubject([]);

	private OV: OpenVidu = null;
	private OVScreen: OpenVidu = null;

	private webcamSession: Session = null;
	private screenSession: Session = null;

	private webcamUser: UserModel = null;
	private screenUser: UserModel = null;

	private videoSource = undefined;
	private audioSource = undefined;
	private sessionId = '';
	private log: ILogger;

	private screenMediaStream: MediaStream;
	private webcamMediaStream: MediaStream;

	constructor(private loggSrv: LoggerService) {
		this.log = this.loggSrv.get('OpenViduSessionService');
		this.OV = new OpenVidu();
		this.OVScreen = new OpenVidu();

		this.OVUsers = this._OVUsers.asObservable();
		this.webcamUser = new UserModel();
		this._OVUsers.next([this.webcamUser]);
	}

	initSessions() {
		this.webcamSession = this.OV.initSession();
		this.screenSession = this.OVScreen.initSession();
	}

	getWebcamSession(): Session {
		return this.webcamSession;
	}

	getScreenSession(): Session {
		return this.screenSession;
	}

	async connectWebcamSession(token: string): Promise<any> {
		if (!!token) {
			await this.webcamSession.connect(token, { clientData: this.getWebcamUserName() });
		}
	}

	async connectScreenSession(token: string): Promise<any> {
		if (!!token) {
			await this.screenSession.connect(token, { clientData: this.getScreenUserName() });
		}
	}

	async publishWebcam(): Promise<any> {
		if (!this.webcamUser.getConnectionId()) {
			this.webcamUser.setConnectionId(this.webcamSession.connection?.connectionId);
			// this.webcamUser.setLocalConnectionId(this.webcamSession.connection.connectionId);
		}
		if (this.webcamSession.capabilities.publish) {
			const publisher = <Publisher>this.webcamUser.getStreamManager();
			if (!!publisher) {
				await this.webcamSession.publish(publisher);
			}
			return;
		}
		this.log.w('User cannot publish');
	}

	async publishScreen(): Promise<any> {
		if (!this.screenUser.getConnectionId()) {
			this.screenUser.setConnectionId(this.screenSession.connection.connectionId);
		}
		if (this.screenSession.capabilities.publish) {
			const publisher = <Publisher>this.screenUser.getStreamManager();
			if (!!publisher) {
				return await this.screenSession.publish(publisher);
			}
			return;
		}
		this.log.w('User cannot publish');
	}

	unpublishWebcam() {
		const publisher = <Publisher>this.webcamUser.getStreamManager();
		if (!!publisher) {
			this.publishScreenAudio(this.hasWebcamAudioActive());
			this.webcamSession.unpublish(publisher);
		}
	}

	unpublishScreen() {
		const publisher = <Publisher>this.screenUser.getStreamManager();
		if (!!publisher) {
			this.screenSession.unpublish(publisher);
		}
	}

	enableWebcamUser() {
		this._OVUsers.next([this.webcamUser, this.screenUser]);
	}

	disableWebcamUser() {
		// this.destryowebcamUser();
		this._OVUsers.next([this.screenUser]);
	}

	enableScreenUser(screenPublisher: Publisher) {
		const connectionId = this.screenSession?.connection?.connectionId;

		this.screenUser = new UserModel(connectionId, screenPublisher, this.getScreenUserName());
		this.screenUser.setUserAvatar(this.webcamUser.getAvatar());

		if (this.isWebCamEnabled()) {
			this._OVUsers.next([this.webcamUser, this.screenUser]);
			return;
		}

		this.log.d('ENABLED SCREEN SHARE');
		this._OVUsers.next([this.screenUser]);
	}

	disableScreenUser() {
		this.destryoScreenUser();
		this._OVUsers.next([this.webcamUser]);
	}

	initCamPublisher(targetElement: string | HTMLElement, properties: PublisherProperties): Publisher {
		const publisher = this.initPublisher(targetElement, properties);
		this.webcamUser.setStreamManager(publisher);
		return publisher;
	}

	publishVideo(isVideoActive: boolean) {
		(<Publisher>this.webcamUser.getStreamManager()).publishVideo(isVideoActive);
		// Send event to subscribers because of viedeo has changed and view must update
		this._OVUsers.next(this._OVUsers.getValue());
	}

	publishWebcamAudio(audio: boolean) {
		const publisher = <Publisher>this.webcamUser?.getStreamManager();
		if (!!publisher) {
			publisher.publishAudio(audio);
		}
	}

	publishScreenAudio(audio: boolean) {
		const publisher = <Publisher>this.screenUser?.getStreamManager();
		if (!!publisher) {
			publisher.publishAudio(audio);
		}
	}

	async replaceTrack(videoSource: string, audioSource: string) {
		this.log.d('Replacing ' + !!videoSource ? 'video' : 'audio' + ' track: ' + !!videoSource ? videoSource : audioSource);
		let track: MediaStreamTrack;
		if (!!videoSource) {
			this.videoSource = videoSource;
		}
		if (!!audioSource) {
			this.audioSource = audioSource;
		}

		const properties = this.createProperties(
			this.videoSource,
			this.audioSource,
			this.hasWebcamVideoActive(),
			this.hasWebcamAudioActive(),
			true
		);

		this.webcamMediaStream = await this.OV.getUserMedia(properties);
		track = !!videoSource ? track = this.webcamMediaStream.getVideoTracks()[0] : this.webcamMediaStream.getAudioTracks()[0];
		await (<Publisher>this.webcamUser.getStreamManager()).replaceTrack(track);
	}

	async replaceScreenTrack() {
		const videoSource = ScreenType.SCREEN;
		const hasAudio = !this.isWebCamEnabled();
		const properties = this.createProperties(videoSource, undefined, true, hasAudio, false);

		this.screenMediaStream = await this.OVScreen.getUserMedia(properties);
		await (<Publisher>this.screenUser.getStreamManager()).replaceTrack(this.screenMediaStream.getVideoTracks()[0]);
	}

	initScreenPublisher(targetElement: string | HTMLElement, properties: PublisherProperties): Publisher {
		this.log.d('init screen properties', properties);
		return  this.initPublisher(targetElement, properties);
	}

	destroyUsers() {
		this.destryoScreenUser();
		this.destryoWebcamUser();
		// Initial state
		this._OVUsers.next([this.webcamUser]);
	}

	disconnect() {
		if (this.screenSession) {
			this.screenSession.disconnect();
			this.stopScreenTracks();
			this.screenSession = null;
		}
		if (this.webcamSession) {
			this.webcamSession.disconnect();
			this.stopWebcamTracks();
			this.webcamSession = null;
		}
		this.screenUser = null;
		this.videoSource = undefined;
		this.audioSource = undefined;
		this.sessionId = '';

		this.webcamUser = new UserModel();
		this._OVUsers.next([this.webcamUser]);
	}

	isWebCamEnabled(): boolean {
		return this._OVUsers.getValue()[0].isCamera();
	}

	isOnlyScreenConnected(): boolean {
		return this._OVUsers.getValue()[0].isScreen();
	}

	hasWebcamVideoActive(): boolean {
		return this.webcamUser.isVideoActive();
	}

	hasWebcamAudioActive(): boolean {
		return this.webcamUser?.isAudioActive();
	}

	hasScreenAudioActive(): boolean {
		return this.screenUser?.isAudioActive();
	}

	areBothConnected(): boolean {
		return this._OVUsers.getValue().length === 2;
	}

	isOnlyWebcamConnected(): boolean {
		return this.isWebCamEnabled() && !this.areBothConnected();
	}

	isScreenShareEnabled(): boolean {
		return this.areBothConnected() || this.isOnlyScreenConnected();
	}

	isMyOwnConnection(connectionId: string): boolean {
		// this.log.d('CONNECTION ID', connectionId);
		// this.log.d('CONNECTION WBCAM', this.webcamUser?.getConnectionId());
		// this.log.d('CONNECTION SCREEN', this.screenUser?.getConnectionId());
		return this.webcamUser?.getConnectionId() === connectionId || this.screenUser?.getConnectionId() === connectionId;
	}

	createProperties(
		videoSource: string | MediaStreamTrack | boolean,
		audioSource: string | MediaStreamTrack | boolean,
		publishVideo: boolean,
		publishAudio: boolean,
		mirror: boolean
	): PublisherProperties {
		return {
			videoSource,
			audioSource,
			publishVideo,
			publishAudio,
			mirror
		};
	}

	setSessionId(sessionId: string) {
		this.sessionId = sessionId;
	}

	getSessionId(): string {
		return this.sessionId;
	}

	setWebcamAvatar() {
		this.webcamUser.setUserAvatar();
	}

	setAvatar(option: AvatarType, avatar?: string): void {
		if ((option === AvatarType.RANDOM && avatar) || (AvatarType.VIDEO && avatar)) {
			if (option === AvatarType.RANDOM) {
				this.webcamUser.setUserAvatar(avatar);
			}
		}
	}

	setWebcamName(nickname: string) {
		this.webcamUser.setNickname(nickname);
	}

	getWebCamAvatar(): string {
		return this.webcamUser.getAvatar();
	}

	getWebcamUserName(): string {
		return this.webcamUser.getNickname();
	}

	getScreenUserName() {
		return this.getWebcamUserName() + '_SCREEN';
	}

	resetUsersZoom() {
		this.webcamUser?.setVideoSizeBig(false);
		this.screenUser?.setVideoSizeBig(false);
	}

	toggleZoom(connectionId: string) {
		if (this.webcamUser.getConnectionId() === connectionId) {
			this.webcamUser.setVideoSizeBig(!this.webcamUser.isVideoSizeBig());
			return;
		}
		this.screenUser.setVideoSizeBig(!this.screenUser.isVideoSizeBig());
	}

	private initPublisher(targetElement: string | HTMLElement, properties: PublisherProperties): Publisher {
		return this.OV.initPublisher(targetElement, properties);
	}

	private destryoScreenUser() {
		if (this.screenUser?.getStreamManager()) {
			// this.screenUser.getStreamManager().off('streamAudioVolumeChange');
			this.screenUser.getStreamManager().stream.disposeWebRtcPeer();
			this.screenUser.getStreamManager().stream.disposeMediaStream();
		}
	}

	private destryoWebcamUser() {
		if (this.webcamUser?.getStreamManager()) {
			// this.webcamUser.getStreamManager().off('streamAudioVolumeChange');
			this.webcamUser.getStreamManager().stream.disposeWebRtcPeer();
			this.webcamUser.getStreamManager().stream.disposeMediaStream();
		}
	}


	private stopScreenTracks() {
		if (this.screenMediaStream) {
			this.screenMediaStream.getTracks().forEach(track => {
				track.stop();
			});
		}
	}
	private stopWebcamTracks() {
		if (this.webcamMediaStream) {
			this.webcamMediaStream.getTracks().forEach(track => {
				track.stop();
			});
		}
	}
}
