type ObjectDefinitionRoot = { [id: string]: ObjectDefinition };
type ObjectDefinition = iobJS.Object & {
  // Those properties are removed before passing the object to ioBroker.
  nested?: ObjectDefinitionRoot;
  script?: any;
};

class ObjectCreator {
  public static async create(
    definition: ObjectDefinitionRoot,
    baseId: string,
  ): Promise<void> {
    const promises = Object.entries(definition).map(async ([id, def]) => {
      const objectId = this.contextualId(baseId, id);
      const data = this.definition(def);

      log(`Creating ${objectId} from ${JSON.stringify(data)}`, 'debug');
      await setObjectAsync(objectId, data);
      log(`Created ${objectId}`);

      if (def.nested) {
        await this.create(def.nested, objectId);
      }
    });

    await Promise.all(promises);
  }

  private static contextualId(base: string, id: string) {
    return `${base}.${id}`;
  }

  private static definition(definition: ObjectDefinition): iobJS.Object {
    const dup = Object.assign({} as ObjectDefinition, definition);
    delete dup.nested;
    delete dup.script;

    return dup;
  }
}
