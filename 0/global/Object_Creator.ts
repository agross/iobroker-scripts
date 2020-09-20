type ObjectDefinitionRoot = { [id: string]: ObjectDefinition };
type ObjectDefinition = iobJS.Object & {
  // Those properties are removed before passing the object to ioBroker.
  nested?: ObjectDefinitionRoot;
  script?: any;
  enumIds?: string[];
};

type EnumIdsToObjects = { [id: string]: string[] };

class ObjectCreator {
  public static async create(
    definition: ObjectDefinitionRoot,
    baseId: string,
  ): Promise<void> {
    const enums = {} as EnumIdsToObjects;

    await this.createObjects(definition, baseId, enums);
    await this.assignEnums(enums);
  }

  private static async createObjects(
    definition: ObjectDefinitionRoot,
    baseId: string,
    enums: EnumIdsToObjects,
  ): Promise<void> {
    const promises = Object.entries(definition).map(async ([id, def]) => {
      const objectId = this.contextualId(baseId, id);
      const data = this.definition(def);

      log(`Creating ${objectId} from ${JSON.stringify(data)}`, 'debug');
      await setObjectAsync(objectId, data);
      log(`Created ${objectId}`);

      this.assign(enums, objectId, def.enumIds);

      if (def.nested) {
        await this.createObjects(def.nested, objectId, enums);
      }
    });

    await Promise.all(promises);
  }

  private static assign(
    mapping: EnumIdsToObjects,
    objectId: string,
    enumIds: string[],
  ): void {
    if (!enumIds) {
      return;
    }

    enumIds.forEach(enumId => {
      if (!mapping.hasOwnProperty(enumId)) {
        mapping[enumId] = [];
      }

      mapping[enumId].push(objectId);
    });
  }

  private static async assignEnums(enums: EnumIdsToObjects): Promise<void> {
    for (let [enumId, objectIds] of Object.entries(enums)) {
      const _enum = await getObjectAsync(enumId);
      const common = (_enum.common as unknown) as { members: string[] };

      const members = Array.from(common.members);
      objectIds.forEach(objectId => {
        if (!members.includes(objectId)) {
          log(`Appending ${objectId} to ${enumId}`);
          members.push(objectId);
        }
      });

      if (members.length != common.members.length) {
        log(`Saving ${enumId}`);
        await extendObjectAsync(enumId, { common: { members: members } });
      }
    }
  }

  private static contextualId(base: string, id: string) {
    return `${base}.${id}`;
  }

  private static definition(definition: ObjectDefinition): iobJS.Object {
    const dup = Object.assign({} as ObjectDefinition, definition);
    delete dup.nested;
    delete dup.script;
    delete dup.enumIds;

    return dup;
  }
}
