# Releases

A build is the APK or app made from one commit. Its build number is that commit's count on the branch (`git rev-list --count HEAD`), so a later commit always has a higher number and installs over an earlier one. Settings → About shows the version (`expo.version` in `app.json`), the build and the commit, so a screenshot names exactly what was running.

## Making a build

`mobile/scripts/build-preview.sh` (on the Mac) builds "torrential preview" from a clean tree and writes `~/Desktop/torrential-preview-<version>-<build>-<commit>.apk`, plus `~/Desktop/torrential-preview.apk` for scripts that install the latest. It refuses uncommitted or untracked changes, so the build number always means one commit.

Android won't install a lower `versionCode` over a higher one. To go back to an older build, uninstall first or use `adb install -r -d`.

## Recording a build that passed on a device

A build counts as verified only once it has been checked on a real device. Record it in two places:

1. **An annotated tag** on the build's commit, named `mobile-b<build>`. Its message says what was checked, on which device, and any number measured:

   ```sh
   git tag -a mobile-b1042 <commit> -m "Preview build 1042 on the Poco F6

   Checked: cold start, search, a title page, play and seek in Big Buck Bunny,
   Download to this phone. Title opens in 212 ms (was 340)."
   git push origin mobile-b1042
   ```

2. **One line** in the list below: build, version, commit, date, device, what was checked.

Tags are only for builds that were checked. A build that failed on the device gets no tag; fix it and record the next one.

## Verified builds

| Build | Version | Commit | Date | Device | Checked |
|---|---|---|---|---|---|
