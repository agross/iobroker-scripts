class Lovelace {
  public static id(val: string): string {
    return val.replace(/[^\w]/g, '_');
  }
}
