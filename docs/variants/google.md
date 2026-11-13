# Mapuga / Google Maps

HTML: dist/variants/google.html

Google-карта, Places Autocomplete New и Routes Library. Places Details вызывается только после выбора адреса, а не для каждой подсказки.

Проверено: 2026-11-13.

1. Включить billing, Maps JavaScript API, Places API (New) и Routes API в одном Google Cloud project. Ограничить browser key по HTTP referrer и API.

2. Dynamic Maps: 10 000 загрузок/месяц бесплатно. Поиск, Place Details и Routes имеют отдельные квоты. Бюджетное уведомление не ограничивает расходы: нужны квоты.

3. Запрашиваются только location/formattedAddress; displayName и фотографии не запрашиваются. Сессионный токен Places обновляется после выбора. Лимит HTML-варианта — 10 точек, без traffic и оптимизации.

4. Здесь реализован планировщик. GPS-ведение для Google-варианта не подключено; Android Navigation SDK — отдельная интеграция и тарификация. Бесплатный нативный Maps SDK не делает Places/Routes бесплатными.

5. Результаты Google выводятся на Google-карте. GPX и постоянное сохранение API-ответов отключены; нельзя переносить эти результаты на OSM как способ обхода условий. Ключи не сохраняются.

Источники:

- [Тарифы](https://developers.google.com/maps/billing-and-pricing/pricing)
- [JS billing](https://developers.google.com/maps/documentation/javascript/usage-and-billing)
- [Places sessions](https://developers.google.com/maps/documentation/places/web-service/session-pricing)
- [Routes Library](https://developers.google.com/maps/documentation/javascript/routes/get-a-route)
- [Условия сервисов](https://cloud.google.com/maps-platform/terms/maps-service-terms)
- [Общие ограничения использования](https://cloud.google.com/maps-platform/terms)

Ключей в комплекте нет. Живая проверка платных/ключевых API без ключей не выполнена.
