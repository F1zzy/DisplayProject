/** Island charts use hour buckets on a dummy date; label by hour. */
export const shortDateFmt = {
  format(date: Date) {
    return `${String(date.getHours()).padStart(2, "0")}:00`;
  },
};

export const weekdayDateFmt = {
  format(date: Date) {
    return `${String(date.getHours()).padStart(2, "0")}:00`;
  },
};

export const hmsTimeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

// `Intl.NumberFormat.prototype.format` is a bound getter — safe to extract.
export const intFmt = new Intl.NumberFormat("en-US").format;
