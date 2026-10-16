# Android gelistirme (Ubuntu / WSL2)

Yerel SDK: `$HOME/Android/Sdk`. Android Studio gerekmez.
Sanal cihaz: `Okuma_Halkasi_API_36`, Pixel 7, Android 16 / API 36,
Google APIs, x86_64. KVM erisimi `emulator -accel-check` ile kontrol edilir.

## Emulatoru ac

Bir terminalde:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
QT_QPA_PLATFORM=xcb "$ANDROID_HOME/emulator/emulator" \
  -avd Okuma_Halkasi_API_36 -gpu swiftshader -feature -Vulkan \
  -memory 2560 -cores 2 -no-audio -no-metrics -crash-report-mode disabled
```

Emulator penceresini acik birak. SwiftShader WSL ekran surucusune bagimliligi
azaltir; KVM CPU hizlandirmasi ayrica kullanilir. Vulkan bu ortamda acilista
takilabildigi icin kapatilidir. Son iki bayrak testte rapor istemini kapatir.

## Ortak web sunucusu

Mobil artik webin ayni ekranlarini acar. Bir terminalde, proje kokunde:

```bash
nvm use 24
corepack pnpm groups:setup
corepack pnpm groups:dev
```

Bu sentetik iki gruplu ortam http://127.0.0.1:5174 uzerinde calisir. Gercek
hesap/veri kullanmaz. Ayrintilar: [okuma gruplari](READING_GROUPS.md).

## Uygulamayi ac

Proje kokunde ikinci bir terminalde:

```bash
nvm use 24
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
adb -s emulator-5554 reverse tcp:5174 tcp:5174
corepack pnpm mobile:android --device
```

Listeden `Okuma_Halkasi_API_36` emulatorunu sec. Terminali acik birak;
Metro uygulamanin JavaScript paketini sunar. Her kod degisikliginde native
derlemeyi yeniden baslatmak gerekmez; native bagimlilik veya yapilandirma
degisikliginde yeniden derle.

Debug APK zaten kuruluysa `corepack pnpm mobile:dev --localhost` ile Metro'yu
ac; gerekirse `adb reverse tcp:8081 tcp:8081` uygula ve telefondan uygulamayi ac.
USB fiziksel cihaz icin ilgili adb seri numarasini kullan.

Normal giriste sunucu adresi alani yoktur. Farkli bir staging ortamini test
etmek icin Metro/derlemeden once `EXPO_PUBLIC_APP_URL` HTTPS origin'ini ayarla.
Release paketinde bu adres zorunludur; localhost varsayilani kabul edilmez.
Mobil uygulamaya `SESSION_SECRET`, D1 yetkisi veya hesap parolasi ekleme.

## SDK araci secimi

`/usr/bin/sdkmanager` farkli bir SDK kurulumuna isaret edebilir. Paket kurarken
kullaniciya ait resmi araci ve hedef SDK'yi acikca sec:

```bash
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
  "$HOME/Android/Sdk/cmdline-tools/latest/bin/sdkmanager" \
  --sdk_root="$HOME/Android/Sdk" "PAKET_KIMLIGI"
```

Emulator testleri gercek cihaz, iOS veya ozellik esligi kaniti sayilmaz.
Sonuclari [mobil kabul listesinde](MOBILE_ACCEPTANCE.md) ayri kaydet.

Kaynaklar: [AVD yonetimi](https://developer.android.com/tools/avdmanager),
[emulator komutlari](https://developer.android.com/studio/run/emulator-commandline).
