// Une clases condicionales: cx('a', cond && 'b', null) → 'a b'
export const cx = (...clases) => clases.filter(Boolean).join(' ');
