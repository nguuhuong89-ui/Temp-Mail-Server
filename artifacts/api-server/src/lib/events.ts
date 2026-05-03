import { EventEmitter } from "node:events";

export type EmailEvent = {
  toAddress: string;
  emailId: number;
  fromAddress: string;
  subject: string;
  receivedAt: string;
};

class EmailBus extends EventEmitter {}

export const emailBus: EmailBus = new EmailBus();
emailBus.setMaxListeners(0);

export function emitEmailReceived(event: EmailEvent): void {
  emailBus.emit(event.toAddress.toLowerCase(), event);
  emailBus.emit("*", event);
}
