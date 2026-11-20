# تەختەکلیلی کوردی — KurdiKeyboard (Android APK & Web)

پرۆژەی تەواوی **تەختەکلیلی کوردی (KurdiKeyboard)** ئامادەکراوە بۆ دروستکردنی خۆکاری **APK** لە ڕێگەی **GitHub Actions**.

## چۆنیەتی دروستکردنی APK لە GitHub (تەنها ٣ هەنگاو)

1. لە هەژماری GitHubـی خۆتدا **Repository**ـیەکی نوێ دروست بکە و هەموو فایلەکانی ئەم پرۆژەیە (یان فایلی `.zip` پاش کردنەوەی) بەرز بکەرەوە (Push / Upload) بۆ برانچی `main`.
2. بچۆ سەر بەشی **Actions** لە GitHub — وۆرکفلۆی **Build KurdiKeyboard Android APK** خۆکارانە دەستپێدەکات (دەشتوانیت دەستی کلیک لە **Run workflow** بکەیت).
3. پاش ٢ تا ٣ خولەک، بچۆ سەر کارە تەواوبووەکە و لە خوارەوە لە بەشی **Artifacts** کلیک لە **`KurdiKeyboard-APK`** بکە بۆ داگرتنی فایلی **`KurdiKeyboard-debug.apk`**.

## چالاککردنی کیبۆردەکە لەسەر مۆبایلی ئەندرۆید
پاش دامەزراندنی APK لەسەر مۆبایلەکەت:
- بچۆ **Settings → System → Languages & input → On-screen keyboard → Manage on-screen keyboards**
- **تەختەکلیلی کوردی** چالاک بکە و وەک کیبۆردی سەرەکی هەڵیبژێرە.
- خزمەتگوزاری کیبۆردەکە پشتگیری `directBootAware="true"` دەکات بۆ کارکردن پاش ڕیستارتی مۆبایل.
