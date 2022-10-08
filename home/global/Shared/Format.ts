declare global {
  interface Date {
    formatDatTime(): string;
  }
}

Date.prototype.formatDatTime = function (): string {
  const format = Intl.DateTimeFormat('de', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  return format.format(new Date(this));
};

// https://github.com/ioBroker/ioBroker.javascript/issues/694#issuecomment-721675742
export {};
