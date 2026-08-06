class Utils {
  public static english(value: iobJS.StringOrTranslated): string {
    if (typeof value === 'string') {
      return value;
    } else {
      return value.en;
    }
  }

  public static shrink(object: object, reference: object): {} {
    if (!object) {
      return object;
    }

    log(JSON.stringify(object), 'debug');
    log(JSON.stringify(reference), 'debug');

    const referenceRecord = (reference || {}) as Record<string, unknown>;
    const referencePropertyNames = Object.getOwnPropertyNames(referenceRecord);
    const dup = { ...object } as Record<string, unknown>;

    log(JSON.stringify(referencePropertyNames), 'debug');

    Object.getOwnPropertyNames(dup).forEach(prop => {
      if (referencePropertyNames.includes(prop)) {
        const value = dup[prop];

        if (typeof value === 'object' && !Array.isArray(value)) {
          log(`Recurse ${prop}`, 'debug');
          dup[prop] = Utils.shrink(
            (value || {}) as {},
            (referenceRecord[prop] || {}) as {},
          );
        } else {
          log(`Keep ${prop}`, 'debug');
        }
      } else {
        log(`Delete ${prop}`, 'debug');
        delete dup[prop];
      }
    });

    return dup;
  }
}
