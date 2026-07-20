function isLeapJalali(jy: number): boolean {
  const r = (jy - 474) % 2820;
  return [1, 5, 9, 13, 17, 22, 26, 30].includes((r % 128) % 33);
}

export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const gMonthDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const isLeapG = (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0);
  if (isLeapG) gMonthDays[2] = 29;

  let gDays = gd;
  for (let i = 1; i < gm; ++i) {
    gDays += gMonthDays[i];
  }
  let jyDays = gDays - 79;
  let jy = gy - 621;

  if (jyDays <= 0) {
    jy -= 1;
    jyDays += isLeapJalali(jy) ? 366 : 365;
  }

  let jm = 1;
  let jd = jyDays;
  for (let i = 1; i <= 11; ++i) {
    const dim = i <= 6 ? 31 : 30;
    if (jd <= dim) {
      jm = i;
      break;
    }
    jd -= dim;
    jm = i + 1;
  }
  return [jy, jm, jd];
}

export function getTodayShamsiString(): string {
  const now = new Date();
  const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${jy}/${pad(jm)}/${pad(jd)}`;
}
