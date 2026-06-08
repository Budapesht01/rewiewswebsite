import { CriterionDef, ContentType } from '@/types'

export const GAME_CRITERIA: CriterionDef[] = [
  { key: 'gameplay',    label: 'Геймплей, Механики и Боевая система',          multiplier: 1.3 },
  { key: 'story',       label: 'Сюжет, Нарратив и Сценарная структура',        multiplier: 1.3 },
  { key: 'technical',   label: 'Техническое исполнение и Визуальные детали',   multiplier: 1.1 },
  { key: 'leveldesign', label: 'Левелдизайн и Мироустройство / Лор',           multiplier: 1.2 },
  { key: 'direction',   label: 'Режиссура, Подача и Постановка кат-сцен',      multiplier: 1.1 },
  { key: 'sound',       label: 'Саундтрек и Звуковой дизайн',                  multiplier: 1.0 },
  { key: 'artdesign',   label: 'Арт-дизайн и Стилистика',                      multiplier: 1.0 },
  { key: 'pacing',      label: 'Игровой темп и Плотность контента',            multiplier: 1.0 },
  { key: 'integrity',   label: 'Цельность проекта и Качество финала',          multiplier: 1.0 },
  { key: 'legacy',      label: 'Влияние на индустрию и Наследие',              multiplier: 1.0 },
]

export const SERIES_CRITERIA: CriterionDef[] = [
  { key: 'script',      label: 'Сценарий, Главный сюжет и Логика',             multiplier: 1.3 },
  { key: 'characters',  label: 'Развитие персонажей и Актёрская игра',         multiplier: 1.3 },
  { key: 'atmosphere',  label: 'Атмосфера, Вайб и Мироустройство / Концепт',  multiplier: 1.2 },
  { key: 'production',  label: 'Масштаб съёмок и Постановка (Production Value)', multiplier: 1.1 },
  { key: 'direction',   label: 'Режиссура, Операторская работа и Монтаж',     multiplier: 1.1 },
  { key: 'sound',       label: 'Саундтрек и Звук',                             multiplier: 1.0 },
  { key: 'pacing',      label: 'Темп, Плотность и Бинж-фактор',               multiplier: 1.0 },
  { key: 'casting',     label: 'Кастинг и Второстепенные линии',              multiplier: 1.0 },
  { key: 'integrity',   label: 'Цельность сезонов и Качество финала',         multiplier: 1.0 },
  { key: 'cultural',    label: 'Культурный феномен и Влияние',                multiplier: 1.0 },
]

export const MOVIE_CRITERIA = SERIES_CRITERIA

export function getCriteria(type: ContentType): CriterionDef[] {
  if (type === 'game') return GAME_CRITERIA
  return SERIES_CRITERIA
}

export function calculateScore(
  criteria: Record<string, number>,
  type: ContentType
): number {
  const defs = getCriteria(type)
  let total = 0
  for (const def of defs) {
    const score = criteria[def.key] ?? 1
    total += score * def.multiplier
  }
  return Math.round(total * 10) / 10
}

export const MAX_SCORE = 110

export function getScoreColor(score: number): string {
  const pct = score / MAX_SCORE
  if (pct >= 0.85) return '#ffffff'
  if (pct >= 0.7)  return '#d4d4d4'
  if (pct >= 0.5)  return '#a3a3a3'
  return '#737373'
}
