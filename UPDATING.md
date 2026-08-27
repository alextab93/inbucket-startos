# Updating the upstream version

This package pairs the official `inbucket/inbucket` image with a Rails client built from this repository. Only the first has an upstream to track; the client is ours and versions with the package.

## Determining the upstream version

- **Inbucket** ([inbucket/inbucket](https://github.com/inbucket/inbucket)) — fetch the latest release tag:

  ```sh
  gh release view -R inbucket/inbucket --json tagName -q .tagName
  ```

  The current pin lives in `startos/manifest/index.ts` at `images.main.source.dockerTag`, as `inbucket/inbucket:<version>@sha256:<digest>`.

## Applying the bump

- Resolve the new multi-architecture digest and set it alongside the tag — the tag alone is mutable, and both `linux/amd64` and `linux/arm64` must be present:

  ```sh
  docker buildx imagetools inspect inbucket/inbucket:<version> --format '{{ .Manifest.Digest }}'
  ```

- Check upstream's configuration reference for renames among the `INBUCKET_*` variables in `startos/main.ts`. Inbucket takes its whole configuration from the environment, so a renamed variable reverts silently to its default rather than failing.
- Confirm the REST API paths the Rails client calls are unchanged: `/api/v1/mailbox/…` for reading and deleting, and the `/api/v2/monitor/messages` websocket the monitor subscribes to. A change to either breaks the client without breaking upstream's own interface.
- After installing, send a message to the configured domain and confirm it appears in both the admin interface and the web client — that exercises the SMTP listener, the storage backend, and the client's API and monitor paths together.

## Changing the Rails client

The client is versioned by the package, not by upstream. Bump the packaging revision after `:` in `startos/versions/current.ts` and rebuild; there is no separate release to track. `bundle exec rspec` covers its request and service specs and needs a real PostgreSQL test database.
