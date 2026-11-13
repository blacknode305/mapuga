# Mapuga: реклама и затраты API

Проверено: 2026-11-13. Это арифметические сценарии, не прогноз eCPM Казахстана.

Допущения: 30 дней; 2 рекламные возможности/DAU/день; fill 80%; eligible share 100%; eCPM издателя $0.75; 1 сессия и 1 маршрут/DAU/день; 4 точки; все адреса новые; 3 autocomplete-запроса на выбор; 40 тайлов/сессию; маршруты до 500 км; инфраструктура $0 как допущение. Налоги, труд, привлечение, invalid traffic corrections и разовый Play $25 не включены.

| DAU | Реклама/мес | Geoapify API | Результат Geoapify | Google API (HTML) | Результат Google |
|---:|---:|---:|---:|---:|---:|
| 10 | $0.36 | $0.00 (Free) | $0.36 | $0.00 | $0.36 |
| 100 | $3.60 | $0.00 (Free) | $3.60 | $83.58 | $-79.98 |
| 1000 | $36.00 | $109.00 (API 25) | $-73.00 | $1614.90 | $-1578.90 |
| 10000 | $360.00 | $609.00 (API 250) | $-249.00 | $11072.70 | $-10712.70 |

Формула: DAU × дни × рекламные возможности × fill × монетизируемая доля / 1000 × eCPM. eCPM уже означает выручку издателя; вторично долю рекламной сети не вычитаем.

Geoapify: тайл 0.25 кредита, autocomplete 1, маршрут N точек — N−1 кредит. При этих параметрах Free 3000 кредитов/сутки — примерно до 120 DAU. Вариации суток, GPS-перемещения карты и другие приложения на ключе могут исчерпать лимит раньше.

2ГИС: опубликованная нижняя планка Map Tiles + Suggest + Routing 21 700 ₽/месяц. Это не гарантированная цена выбранной нагрузки. Яндекс: от 20 800 ₽/месяц только Router; другие продукты и лицензия навигатора отдельно. До полного тарифа и согласованного сценария прибыль не считается; рубли не складываются с долларами без курса. В калькулятор можно ввести полную цену в USD самостоятельно.

Google рассчитывается по отдельным SKU: Dynamic Maps, Autocomplete Requests, Place Details Essentials, Compute Routes Essentials. Первые до 12 запросов в завершённой Essentials-сессии оплачиваются как Autocomplete Requests; детали выбранного места отдельно. Постоянное хранение API-контента в Google-HTML выключено. Нативный Maps SDK имеет другую цену отображения карты; Places/Routes/Navigation не становятся бесплатными.

Рекомендация: начать тест с Geoapify Free, ограничить запросы, не брать платный пакет, пока реальные рекламные показатели не подтвердят окупаемость. Это сохраняет пользовательские функции бесплатными, но не обещает отсутствие лимитов/API-расходов при росте. Для актуальности справочника Караганды отдельно сравнить реальные известные адреса; Geoapify основан на OSM.

Интерактивно: dist/variants/calculator.html. Тарифные ссылки находятся в HTML и docs/variants/*.md.

Источники:

- [Geoapify: тарифы](https://www.geoapify.com/pricing/)
- [Geoapify: расход кредитов](https://www.geoapify.com/pricing-details/)
- [Google Maps Platform: SKU и цены](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Google Places: autocomplete sessions](https://developers.google.com/maps/documentation/places/web-service/session-pricing)
- [2ГИС: тарифы](https://docs.2gis.com/platform-manager/subscription/pricing)
- [Яндекс: Router](https://yandex.ru/dev/tariffs/doc/ru/router/prices/)
- [AdMob: определение eCPM](https://support.google.com/admob/answer/6168758?hl=en)
- [Google: региональные ограничения рекламы](https://support.google.com/publisherpolicies/answer/15766875?hl=en)
