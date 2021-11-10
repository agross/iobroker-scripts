class Utils {
  public static shrink(object: {}, ...keepKeys: string[]): {} {
    if (!object) {
      return object;
    }

    Object.getOwnPropertyNames(object).forEach(prop => {
      if (!keepKeys.includes(prop)) {
        delete object[prop];
      }
    });

    return object;
  }
}
