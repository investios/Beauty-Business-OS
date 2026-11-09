import { notFound } from "next/navigation";
import { dictFor, isLoc } from "@/lib/i18n";

const BODY = {
  en: ["Privacy notice: draft", "This is a draft for the demonstration site. It is not a final legal text and must be reviewed by a lawyer before launch.", "What we collect: the name and contact you enter when booking, the content of questions you ask the assistant, and the source of your visit (for example the link or campaign you came from).", "Why: to handle your booking and to answer your questions. Marketing messages are sent only if you tick the separate optional box.", "The assistant is an AI. It answers from information approved by the specialist and passes everything else to her.", "To ask for access to or deletion of your data, contact the specialist (contact details will be added after she confirms them)."],
  ru: ["Уведомление о конфиденциальности: черновик", "Это черновик для демонстрационного сайта. Это не окончательный юридический текст, перед запуском его должен проверить юрист.", "Что мы собираем: имя и контакт, которые вы вводите при записи, содержание ваших вопросов ассистенту и источник визита (например, ссылку или кампанию, с которой вы пришли).", "Зачем: чтобы оформить вашу запись и ответить на вопросы. Маркетинговые сообщения отправляются только если вы отметили отдельную необязательную галочку.", "Ассистент — это ИИ. Он отвечает по информации, утверждённой мастером, а всё остальное передаёт ей.", "Чтобы запросить доступ к данным или их удаление, свяжитесь с мастером (контакты будут добавлены после её подтверждения)."],
  uk: ["Повідомлення про конфіденційність: чернетка", "Це чернетка для демонстраційного сайту. Це не остаточний юридичний текст, перед запуском його має перевірити юрист.", "Що ми збираємо: ім'я та контакт, які ви вводите під час запису, зміст ваших запитань асистенту та джерело візиту (наприклад, посилання чи кампанію, з якої ви прийшли).", "Навіщо: щоб оформити ваш запис і відповісти на запитання. Маркетингові повідомлення надсилаються лише якщо ви позначили окрему необов'язкову галочку.", "Асистент — це ШІ. Він відповідає за інформацією, затвердженою майстром, а все інше передає їй.", "Щоб запросити доступ до даних або їх видалення, зверніться до майстра (контакти буде додано після її підтвердження)."],
};
export default async function Privacy({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLoc(locale)) notFound();
  void dictFor;
  const [h, ...ps] = BODY[locale];
  return <div className="page"><div className="wrap narrow"><h1 style={{ fontSize: "clamp(34px, 8vw, 52px)", marginBottom: 20 }}>{h}</h1><div style={{ display: "grid", gap: 14 }}>{ps.map((p, i) => <p key={i}>{p}</p>)}</div></div></div>;
}
