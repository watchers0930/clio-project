export function validateDateInput(
  key: string,
  value: string,
  setDateErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>,
) {
  if (!value) {
    setDateErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    return;
  }

  const match = value.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!match) {
    if (value.replace(/[\d/]/g, '').length > 0 || value.length >= 10) {
      setDateErrors(prev => ({ ...prev, [key]: 'yyyy/mm/dd 형식으로 입력하세요' }));
    }
    return;
  }

  const [, y, m, d] = match;
  const year = parseInt(y, 10);
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);
  if (month < 1 || month > 12) return void setDateErrors(prev => ({ ...prev, [key]: '월은 01~12 사이여야 합니다' }));
  const lastDay = new Date(year, month, 0).getDate();
  if (day < 1 || day > lastDay) return void setDateErrors(prev => ({ ...prev, [key]: `${month}월은 ${lastDay}일까지입니다` }));
  if (year < 2000 || year > 2099) return void setDateErrors(prev => ({ ...prev, [key]: '연도는 2000~2099 사이여야 합니다' }));

  setDateErrors(prev => {
    const next = { ...prev };
    delete next[key];
    return next;
  });
}

export function formatDateInput(raw: string) {
  const digits = raw.replace(/[^\d]/g, '').slice(0, 8);
  if (digits.length > 6) return `${digits.slice(0, 4)}/${digits.slice(4, 6)}/${digits.slice(6)}`;
  if (digits.length > 4) return `${digits.slice(0, 4)}/${digits.slice(4)}`;
  return digits;
}
