import { ExternalConfigModel } from './external-config';

export class AngularLibraryModel extends ExternalConfigModel {
	private readonly NAME = 'Angular Library';

	constructor() {
		super();
	}

	setTokens(tokens: string[]) {
		if (tokens) {
			this.ovSettings.setScreenSharing(this.ovSettings.hasScreenSharing() && this.tokens?.length > 1);
			super.setTokens(tokens);
		}
	}

	public getComponentName() {
		return this.NAME;
	}
}
