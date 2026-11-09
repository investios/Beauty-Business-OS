// Дополнительные тексты для вариантов B1-B3. Только предложения на согласование, новых фактов об услугах здесь нет:
// каждый ответ берётся из уже существующих карточек услуг (concept-copy.ts).
import type { CLang } from "./concept-copy";
export type BCopy = {
  askTitle: string; askHint: string; ask: { id: string; label: string }[];
  threadLead: string; alsoIn: string; frame: string;
};
export const BCOPY: Record<CLang, BCopy> = {
  ru: {
    askTitle: "Что вы хотите изменить?", askHint: "Выберите, и мы покажем, с чего начать.",
    ask: [
      { id: "extensions", label: "Хочу нарастить волосы" },
      { id: "correction", label: "У меня уже есть наращивание" },
      { id: "removal", label: "Хочу снять наращивание" },
      { id: "consultation", label: "Волосы или кожа головы вызывают вопросы" },
      { id: "hair", label: "Ищу волосы для себя или для салона" },
    ],
    threadLead: "От первого разговора до коррекции", alsoIn: "Что входит", frame: "Фото работы",
  },
  en: {
    askTitle: "What would you like to change?", askHint: "Choose one and we will show you where to start.",
    ask: [
      { id: "extensions", label: "I would like to add hair" },
      { id: "correction", label: "I already have extensions" },
      { id: "removal", label: "I want my extensions removed" },
      { id: "consultation", label: "I have questions about my hair or scalp" },
      { id: "hair", label: "I am looking for hair for myself or a salon" },
    ],
    threadLead: "From the first conversation to your correction", alsoIn: "What is included", frame: "Photo of our work",
  },
  uk: {
    askTitle: "Що ви хочете змінити?", askHint: "Оберіть, і ми покажемо, з чого почати.",
    ask: [
      { id: "extensions", label: "Хочу наростити волосся" },
      { id: "correction", label: "У мене вже є нарощування" },
      { id: "removal", label: "Хочу зняти нарощування" },
      { id: "consultation", label: "Маю питання щодо волосся чи шкіри голови" },
      { id: "hair", label: "Шукаю волосся для себе чи для салону" },
    ],
    threadLead: "Від першої розмови до корекції", alsoIn: "Що входить", frame: "Фото роботи",
  },
};
