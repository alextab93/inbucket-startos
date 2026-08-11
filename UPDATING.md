# Updating Inbucket

The package consumes the official multi-architecture image published as
`inbucket/inbucket`. The active pin is
`images.main.source.dockerTag` in `startos/manifest/index.ts`; the package
version is `startos/versions/current.ts`.

## Determine the next upstream release

1. Fetch the latest stable GitHub release or tag:

   ```sh
   gh release view -R inbucket/inbucket --json tagName,publishedAt,url
   git ls-remote --tags --refs https://github.com/inbucket/inbucket.git
   ```

2. Read the upstream changelog and compare configuration keys, the Dockerfile,
   entrypoint, exposed ports, and declared volumes against the current package.
3. Confirm the matching Docker Hub tag exists and inspect it through Docker
   Hub's tag API:

   ```sh
   curl -fsSL "https://hub.docker.com/v2/repositories/inbucket/inbucket/tags/<version>" \
     | jq '{name, digest, images: [.images[] | {architecture, os, digest}]}'
   ```

4. Require active `linux/amd64` and `linux/arm64` manifests. Record the OCI index
   digest returned in the top-level `digest` field.

The initial package pins stable upstream release `3.1.1` and OCI index
`sha256:4a4c4cf553967e1863e4f48c828774786ac9ee73c53b3a3ecef10f66e5a2cdfb`.
The verified platform digests are:

- `linux/amd64`: `sha256:d17bdd468e9c4a55d9bb437cb9f68fc9f1d2b695aac81b2f82ed339b298daa73`
- `linux/arm64`: `sha256:8835093e993ec3604525abbef425e45eb5a522decfae66e67c5977e25dbabeb4`

## Apply the update

1. Set `images.main.source.dockerTag` to
   `inbucket/inbucket:<version>@sha256:<index-digest>`.
2. Update `version` and translated release notes in
   `startos/versions/current.ts`. Keep editing `current.ts` unless the update
   genuinely requires a data migration.
3. Update this file if image paths, configuration, or the verification process
   changed. Keep version strings out of `README.md` and `instructions.md`.
4. Run:

   ```sh
   npm ci
   npm run prettier
   npm run check
   npm run build
   make
   ```

5. Install the exact artifacts on x86_64 and aarch64 StartOS systems. Verify
   initial domain setup, HTTP and SMTP health checks, inbound delivery, domain
   rejection, restart persistence, one-hour retention, backup, and restore.
6. Re-query Docker Hub immediately before release and confirm the tag still
   resolves to the pinned OCI index digest.

## Outbound SMTP decision gate

Before adding StartOS SMTP credentials during any update, inspect the pinned
upstream source for an actual SMTP client, forwarding, or notification feature.
The current upstream receiver has none. Do not connect StartOS system SMTP or
custom relay credentials unless upstream gains a concrete outbound function or
the package deliberately adds a separately specified forwarding component.
