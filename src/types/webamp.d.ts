declare module 'webamp/butterchurn' {
  export type WebampTrack = {
    url: string;
    metaData?: {
      title?: string;
    };
  };

  export default class Webamp {
    constructor(options?: Record<string, unknown>);
    renderWhenReady(element: HTMLElement): Promise<void>;
    play(): void;
    reopen(): void;
    setTracksToPlay(tracks: WebampTrack[]): void;
    setSkinFromUrl(url: string): void;
  }
}
