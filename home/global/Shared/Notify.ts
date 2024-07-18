import { Observable } from 'rxjs';
import { share } from 'rxjs/operators';

declare global {
  export type MobileNotificationArgs = {
    severity?: iobJS.LogLevel;
    telegram?: object;
  };

  export type CallbackData = { user: string; value: string };

  export class Notify {
    static tv(message: string, severity?: iobJS.LogLevel): Promise<void>;

    static mobile(message: string, args?: MobileNotificationArgs): void;
    static subscribeToCallbacks(): Observable<CallbackData>;
  }
}

export class Notify {
  public static async tv(
    message: string,
    severity?: iobJS.LogLevel,
  ): Promise<void> {
    log(message, severity);

    await setStateAsync('lgtv.0.states.popup', message);
  }

  static get mobileNotifier(): string {
    return 'telegram.0';
  }

  static get mobileNotifierCallbacks(): string {
    return `${this.mobileNotifier}.communicate.request`;
  }

  public static mobile(message: string, args?: MobileNotificationArgs): void {
    log(message, args?.severity);

    sendTo(this.mobileNotifier, {
      user: 'agross42',
      text: message,
      ...(args?.telegram || {}),
    });
  }

  public static subscribeToCallbacks(): Observable<CallbackData> {
    const eventMapper = e => {
      const val: string = e.state.val;

      const split = val.indexOf(']');

      return {
        user: val.substring(1, split),
        value: val.substring(split + 1),
      };
    };

    // Cant't use Stream here.
    return new Observable<CallbackData>(observer => {
      on({ id: this.mobileNotifierCallbacks, ack: true }, event => {
        log(`Mobile notifier callback: ${JSON.stringify(event)}`);

        observer.next(eventMapper(event));
      });
    }).pipe(share());
  }
}
