import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';

export type MailMessage = {
    to: string;
    subject: string;
    text: string;
};

/**
 * Sends through SMTP_URL. Without it, development writes the message to the
 * log so reset links can be followed locally; production refuses to pretend.
 */
@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private transport: Transporter | null = null;

    get configured(): boolean {
        return Boolean(process.env['SMTP_URL']?.trim());
    }

    async send(message: MailMessage): Promise<boolean> {
        const url = process.env['SMTP_URL']?.trim();

        if (!url) {
            if (process.env['NODE_ENV'] === 'production') {
                this.logger.error(
                    `SMTP_URL is not set; "${message.subject}" was not sent`,
                );
                return false;
            }
            this.logger.warn(
                `SMTP_URL is not set. Mail for ${message.to}:\n${message.subject}\n\n${message.text}`,
            );
            return true;
        }

        this.transport ??= nodemailer.createTransport(url);
        await this.transport.sendMail({
            from: process.env['MAIL_FROM'] ?? 'no-reply@localhost',
            to: message.to,
            subject: message.subject,
            text: message.text,
        });
        return true;
    }
}
