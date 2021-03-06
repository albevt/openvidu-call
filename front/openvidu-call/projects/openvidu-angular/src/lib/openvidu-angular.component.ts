import { Component, OnInit, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { VideoRoomComponent } from './video-room/video-room.component';
import { Session, ConnectionEvent, StreamEvent, StreamManagerEvent, SessionDisconnectedEvent } from 'openvidu-browser';
import { UserModel } from './shared/models/user-model';
import { AngularLibraryModel } from './shared/models/angular-library';
import { OpenViduLayout, OpenViduLayoutOptions } from './shared/layout/openvidu-layout';
import { OvSettings } from './shared/types/ov-settings';

@Component({
	selector: 'opv-session',
	template: `
		<app-video-room
			#videoRoom
			*ngIf="display"
			[externalConfig]="angularLibrary"
			(_connectionCreated)="emitConnectionCreatedEvent($event)"
			(_streamCreated)="emitStreamCreatedEvent($event)"
			(_streamPlaying)="emitStreamPlayingEvent($event)"
			(_streamDestroyed)="emitStreamDestroyedEvent($event)"
			(_sessionDisconnected)="emitSessionDisconnectedEvent($event)"
			(_error)="emitErrorEvent($event)"
		>
		</app-video-room>
	`,
	styles: []
})
export class OpenviduSessionComponent implements OnInit {

  angularLibrary: AngularLibraryModel;
  display = false;

	@Input()
	ovSettings: OvSettings;
	@Input()
	sessionName: string;
	@Input()
	user: string;
	@Input()
	openviduServerUrl: string;
	@Input()
	openviduSecret: string;
	@Input()
	tokens: string[];
	@Input()
	theme: string;
	@Output() connectionCreated = new EventEmitter<any>();
	@Output() streamCreated = new EventEmitter<any>();
	@Output() streamPlaying = new EventEmitter<any>();
	@Output() streamDestroyed = new EventEmitter<any>();
	@Output() sessionDisconnected = new EventEmitter<any>();
	@Output() error = new EventEmitter<any>();

	@ViewChild('videoRoom')
	public videoRoom: VideoRoomComponent;

	constructor() {}

	ngOnInit() {
		this.angularLibrary = new AngularLibraryModel();
		this.angularLibrary.setOvSettings(this.ovSettings);
		this.angularLibrary.setSessionName(this.sessionName);
		this.angularLibrary.setOvServerUrl(this.openviduServerUrl);
		this.angularLibrary.setOvSecret(this.openviduSecret);
		this.angularLibrary.setTheme(this.theme);
		this.angularLibrary.setNickname(this.user);
		this.angularLibrary.setTokens(this.tokens);
		if (this.angularLibrary.canJoinToSession()) {
			this.display = true;
		}
	}


	emitConnectionCreatedEvent(event: {event: ConnectionEvent, isLocal: boolean}): void {
		this.connectionCreated.emit(event.event);
		if (event.isLocal) {
			this.videoRoom.checkSizeComponent();
		}
	}

	emitStreamCreatedEvent(event: StreamEvent) {
		this.streamCreated.emit(event);
	}

	emitStreamPlayingEvent(event: StreamManagerEvent) {
		this.streamPlaying.emit(event);
	}

	emitStreamDestroyedEvent(event: StreamEvent) {
		this.streamDestroyed.emit(event);
	}

	emitSessionDisconnectedEvent(event: SessionDisconnectedEvent) {
		this.sessionDisconnected.emit(event);
		// this.display = false;
	}

	emitErrorEvent(event) {
		setTimeout(() => this.error.emit(event), 20);
	}

	getSession(): Session {
		return this.videoRoom.session;
	}

	getLocalUsers(): UserModel[] {
		return this.videoRoom.localUsers;
	}

	getOpenviduLayout(): OpenViduLayout {
		return this.videoRoom.openviduLayout;
	}

	getOpenviduLayoutOptions(): OpenViduLayoutOptions {
		return this.videoRoom.openviduLayoutOptions;
	}
}
