class Device {
  public static id(id: string, initialId?: string): string {
    const deviceId = id.replace(/\.[^.]*$/, '');
    if (deviceId == id) {
      throw new Error(`Could not find device for id "${id}"`);
    }

    if (!existsObject(deviceId)) {
      // Search parent.
      return Device.id(deviceId, initialId ? initialId : id);
    }

    const device = getObject(deviceId);

    if (device.type !== 'device' && device.common.role !== 'device') {
      // Search parent.
      return Device.id(deviceId, initialId ? initialId : id);
    }

    return deviceId;
  }

  public static deviceName(id: string): string {
    const deviceId = Device.id(id);

    const device = getObject(deviceId);

    return device.common.name;
  }

  public static type(id: string): string {
    const deviceId = Device.id(id);

    const device = getObject(deviceId);

    return device.common.type;
  }
}
