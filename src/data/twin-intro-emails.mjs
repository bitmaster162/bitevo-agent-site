function draft(subject, body) {
  return `mailto:robert@bitevo.work?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const twinIntroEmails = {
  en: {
    intro: draft('BitEvo Twin intro', 'Hi Robert, I would like to arrange a free 30-minute Twin introduction. The decision history we want to find is: '),
    team: draft('BitEvo Team Twin · pilot enquiry', 'Hi Robert, I would like a free 30-minute call about a Team Twin pilot for one team. The process or decision history we want to cover is: '),
    company: draft('BitEvo Company Twin · company-wide enquiry', 'Hi Robert, I would like a free 30-minute call about a company-wide Twin. The teams and decision history we want to connect are: '),
  },
  ru: {
    intro: draft('BitEvo Twin · знакомство', 'Роберт, здравствуйте! Хочу согласовать бесплатный 30-минутный звонок о Twin. Хотим находить историю таких решений: '),
    team: draft('BitEvo Team Twin · пилот для команды', 'Роберт, здравствуйте! Хочу согласовать бесплатный 30-минутный звонок о пилоте Team Twin для одной команды. Нас интересует история следующего процесса или решения: '),
    company: draft('BitEvo Company Twin · запрос от компании', 'Роберт, здравствуйте! Хочу согласовать бесплатный 30-минутный звонок о Company Twin. Вот каким командам нужна общая история решений: '),
  },
};
