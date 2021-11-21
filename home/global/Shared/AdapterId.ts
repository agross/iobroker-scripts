class AdapterId {
  // Cannot use "type: keyof typeof AdapterIds" because this would introduce a
  // dependency between 2 global scripts.
  public static build(type: string, id: string): string {
    return `${type}.${id}`.replace(/\.{2,}/, '.');
  }
}
