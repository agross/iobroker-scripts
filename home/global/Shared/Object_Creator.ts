declare global {
  export type ObjectDefinitionRoot = { [id: string]: ObjectDefinition };

  export type ObjectDefinition = iobJS.SettableObject & {
    // Those properties are removed before passing the object to ioBroker.
    nested?: ObjectDefinitionRoot;
    script?: any;
    enumIds?: string[];
  };

  export class ObjectCreator {
    static create(
      definition: ObjectDefinitionRoot,
      baseId: string,
    ): Promise<void>;

    static getEnumIds(objectId: string, ...kinds: string[]): string[];
  }
}

type EnumIdsToObjects = { [id: string]: string[] };

export class ObjectCreator {
  public static async create(
    definition: ObjectDefinitionRoot,
    baseId: string,
  ): Promise<void> {
    const enums = {} as EnumIdsToObjects;

    await this.createObjects(definition, baseId, enums);
    await this.assignEnums(enums);
  }

  public static getEnumIds(objectId: string, ...kinds: string[]): string[] {
    return kinds
      .map(kind => (getObject(objectId, kind) as any).enumIds as string[])
      .reduce((acc, ids) => acc.concat(ids));
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

      if (!(await existsStateAsync(objectId))) {
        if (data.type === 'state' && !data.common.alias) {
          const defaultValue = this.defaultValue(data.common);
          await setStateAsync(objectId, defaultValue, true);

          log(
            `Set default value '${defaultValue}' for unaliased state ${objectId}`,
          );
        }
      }

      if (def.nested) {
        await this.createObjects(def.nested, objectId, enums);
      }
    });

    await Promise.all(promises);
  }

  private static defaultValue(common: iobJS.StateCommon): any {
    const defaultValue = common.def;
    if (defaultValue !== undefined) {
      return defaultValue;
    }

    switch (common.type) {
      case 'array':
        return JSON.stringify([]);

      case 'boolean':
        return false;

      case 'number':
        return 0;

      case 'object':
        return JSON.stringify({});

      case 'string':
        return '';

      default:
        return null;
    }
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
      const common = _enum.common as unknown as { members: string[] };

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
    const dup = Object.assign({} as iobJS.Object, definition);

    delete dup.nested;
    delete dup.script;
    delete dup.enumIds;

    return dup;
  }
}
