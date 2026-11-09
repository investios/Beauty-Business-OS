// Провайдер почты НЕ подключён. Честно фиксируем статус, а не изображаем отправку.
export type DeliveryStatus = "not_configured" | "sent" | "failed";
export async function deliverEmail(_to: string, _subject: string, _body: string): Promise<DeliveryStatus> {
  if (!process.env.EMAIL_PROVIDER_API_KEY) return "not_configured";
  // Реальная отправка подключается здесь (Resend/Postmark/SES) после настройки SPF/DKIM/DMARC домена.
  return "failed";
}
