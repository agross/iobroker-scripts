class Utils {
  public static shrink(object: {}, reference: {}): {} {
    if (!object) {
      return object;
    }

    log(JSON.stringify(object), 'debug');
    log(JSON.stringify(reference), 'debug');

    const referencePropertyNames = Object.getOwnPropertyNames(reference || {});
    const dup = { ...object };

    log(JSON.stringify(referencePropertyNames), 'debug');

    Object.getOwnPropertyNames(dup).forEach(prop => {
      if (referencePropertyNames.includes(prop)) {
        if (typeof dup[prop] === 'object' && !Array.isArray(dup[prop])) {
          log(`Recurse ${prop}`, 'debug');
          dup[prop] = this.shrink(dup[prop], reference[prop]);
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
