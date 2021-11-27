# iobroker-scripts ![CI](https://github.com/agross/iobroker-scripts/actions/workflows/typescript.yml/badge.svg)

My collection of scripts for ioBroker.

## Dependencies

You need to install the following dependencies in your ioBroker.javascript instances:

* `rxjs@7`
* `got@11`

Syntax help may be added for the following npm modules:

* `rxjs`
* `rxjs/operators`
* `got`

## Remote development

Instead of coding locally (e.g. with VS Code) and always copy/pasting the script
contents to ioBroker's script directory, you can develop locally with type
checking, formatting etc. but work directly on the ioBroker host.

Assuming you run ioBroker on docker:

1. In your docker setup, mount a directory from the ioBroker host to the
   container. E.g. `--volume
   /data/iobroker/scripts:/opt/iobroker/mirrored-scripts` where
   `/data/iobroker/scripts` is the directory on the host.
1. In the iobroker.javascript instance settings, specify to "Mirror scripts to
   file path" `/opt/iobroker/mirrored-scripts/0` (I include the javascript
   instance number at the end). The contents of this directory will then be made
   available on the host via the mount created in step 1.
1. There is a `mount` script that will connect to ioBroker's host via SSH and
   mount the remote directory to the `host` subdirectory. You can work normally.
   When you save files, these will be saved to the ioBroker host and the
   JavaScript adapter will reload the script accordingly. To specify a specific
   host run `MOUNT=your-host ./mount`.
