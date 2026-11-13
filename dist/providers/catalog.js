(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MapugaProviders = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const checked = '2026-11-13';
  const profiles = [
    {
      id:'osm', name:'OpenStreetMap', tag:'Без ключа · прототип', maxPoints:20, navigation:true, export:true, persist:true, keys:[],
      summary:'Текущая Mapuga: Leaflet, Photon и OSRM. Работает сразу; публичный OSRM demo не подходит как бесплатная инфраструктура приложения с рекламой.',
      requirements:['Ключ не нужен. Для GPS — HTTPS или localhost и разрешение геолокации.', 'Photon допускает умеренную нагрузку без гарантий. OSRM demo — разумное некоммерческое использование, максимум 1 запрос/с.', 'Перед монетизацией заменить публичный маршрутизатор и поиск на коммерчески допустимый тариф или собственный сервер. Расходы сервера не равны нулю.', 'Обязательны атрибуция OSM, HTTP-кеширование тайлов и соблюдение Tile Usage Policy. Массовой загрузки и офлайн-карт в этой версии нет.'],
      sources:[['OSM tiles','https://operations.osmfoundation.org/policies/tiles/'],['Photon','https://github.com/komoot/photon#demo-server'],['OSRM demo','https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server']],
    },
    {
      id:'geoapify', name:'Geoapify', tag:'Кандидат для бесплатного старта', maxPoints:20, navigation:true, export:true, persist:true,
      keys:[['apiKey','Geoapify browser API key']],
      summary:'OSM-данные через коммерчески допустимый сервис. Free: 3000 кредитов в день, до 5 запросов/с, без банковской карты. Свежесть организаций не гарантируется.',
      requirements:['Создать проект Geoapify и browser key; ограничить ключ разрешёнными доменами. Ключ вводится только в память текущей вкладки.', 'Free разрешён для commercial production с атрибуцией Geoapify и источников. При превышении квоты нужен тариф/изменение нагрузки; безлимитного бесплатного API нет.', 'Тайл = 0,25 кредита, autocomplete = 1, маршрут = число точек − 1; длинные маршруты имеют дополнительные кредиты. GPS сопоставляется локально, но движение карты загружает новые тайлы.', 'GPS, русские подсказки, демо, GPX и локальное сохранение предусмотрены. Перед Android-релизом нужны тесты реальной поездки, HTTPS/нативные разрешения и privacy policy.'],
      sources:[['Тарифы и commercial Free','https://www.geoapify.com/pricing/'],['Стоимость запросов','https://www.geoapify.com/pricing-details/'],['Autocomplete','https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/'],['Routing + GPS','https://www.geoapify.com/routing-api/'],['Права на результаты','https://www.geoapify.com/products-and-services/']],
    },
    {
      id:'google', name:'Google Maps', tag:'Бесплатные квоты + billing', maxPoints:10, navigation:false, export:false, persist:false,
      keys:[['apiKey','Google Maps browser API key'],['mapId','Map ID (необязательно; для теста DEMO_MAP_ID)']],
      summary:'Google-карта, Places Autocomplete New и Routes Library. Places Details вызывается только после выбора адреса, а не для каждой подсказки.',
      requirements:['Включить billing, Maps JavaScript API, Places API (New) и Routes API в одном Google Cloud project. Ограничить browser key по HTTP referrer и API.', 'Dynamic Maps: 10 000 загрузок/месяц бесплатно. Поиск, Place Details и Routes имеют отдельные квоты. Бюджетное уведомление не ограничивает расходы: нужны квоты.', 'Запрашиваются только location/formattedAddress; displayName и фотографии не запрашиваются. Сессионный токен Places обновляется после выбора. Лимит HTML-варианта — 10 точек, без traffic и оптимизации.', 'Здесь реализован планировщик. GPS-ведение для Google-варианта не подключено; Android Navigation SDK — отдельная интеграция и тарификация. Бесплатный нативный Maps SDK не делает Places/Routes бесплатными.', 'Результаты Google выводятся на Google-карте. GPX и постоянное сохранение API-ответов отключены; нельзя переносить эти результаты на OSM как способ обхода условий. Ключи не сохраняются.'],
      sources:[['Тарифы','https://developers.google.com/maps/billing-and-pricing/pricing'],['JS billing','https://developers.google.com/maps/documentation/javascript/usage-and-billing'],['Places sessions','https://developers.google.com/maps/documentation/places/web-service/session-pricing'],['Routes Library','https://developers.google.com/maps/documentation/javascript/routes/get-a-route'],['Условия сервисов','https://cloud.google.com/maps-platform/terms/maps-service-terms'],['Общие ограничения использования','https://cloud.google.com/maps-platform/terms']],
    },
    {
      id:'2gis', name:'2ГИС', tag:'Пробный месяц → подписка', maxPoints:10, navigation:false, export:false, persist:false,
      keys:[['mapKey','Map Tiles / MapGL browser key'],['searchKey','Suggest API browser key'],['routeKey','Routing API key (или оставьте пустым для локального proxy)']],
      summary:'MapGL, Suggest route_endpoint и Routing 7. Подходит для сравнения местного справочника; без ключей и подписки API нельзя проверить.',
      requirements:['Нужен доступ к Map Tiles, Suggest и Routing. Можно использовать один ключ с нужными продуктами или отдельные ограниченные ключи.', 'Демо — месяц. Минимальные месячные пакеты по опубликованному тарифу: Map Tiles 8000 ₽, Suggest 7000 ₽, Routing 6700 ₽. Это нижняя планка 21 700 ₽, а не цена любой нагрузки.', 'До 10 точек вместе со стартом и финишем. Прямой browser Routing 7 зависит от CORS и ограничений ключа. Локальный proxy /api/2gis/route использует MAPUGA_2GIS_ROUTING_KEY в окружении Node.', 'Proxy в комплекте — только для локального теста. Перед публикацией нужны HTTPS, общий серверный лимит, защита от чужого расходования ключа и производственный хостинг.', 'Этот HTML — планировщик. GPS-ведение, GPX и хранение ответов не включены: для них согласовать продукт SDK/навигации и права на хранение/экспорт.'],
      sources:[['Тарифы','https://docs.2gis.com/platform-manager/subscription/pricing'],['MapGL','https://docs.2gis.com/mapgl/start/first-steps'],['Suggest','https://docs.2gis.com/api/search/suggest/reference/3.0/suggests'],['Routing 7','https://docs.2gis.com/api/navigation/routing/start'],['Оферта','https://law.2gis.ru/webapi-offer']],
    },
    {
      id:'yandex', name:'Яндекс Карты', tag:'Проверить лицензию навигатора', maxPoints:10, navigation:false, export:false, persist:false,
      keys:[['mapKey','JavaScript API v3 key'],['suggestKey','Геосаджест key'],['searchKey','Геокодер / Search key'],['routeKey','Router key']],
      summary:'JS API v3, suggest → search после выбора, Router. Наличие бесплатной карты не означает бесплатную маршрутизацию и право выпускать самостоятельный навигатор.',
      requirements:['Подключить продукты JS API, Геосаджест, Геокодер и Router; задать разрешённый HTTP Referer, включая localhost для теста.', 'Map hits бесплатны. Router по опубликованному месячному тарифу — от 20 800 ₽ за 1000 ответов/сутки; trial 7 дней по 100 ответов/сутки. Остальные продукты учитываются отдельно.', 'Suggest и геокодер имеют собственные бесплатные лимиты и правила. 195 000 ₽/год у JS API относится к панорамам, а не к обычной загрузке карты.', 'Текущие условия ограничивают похожие на Яндекс Карты приложения, realtime monitoring и сохранение данных (кроме разрешённого технического кеша). Для самостоятельной Mapuga-навигации нужно согласовать лицензию/NaviKit.', 'Этот HTML — планировщик без GPS-ведения, GPX и постоянного сохранения API-ответов. Логотипы, атрибуция и кнопка «Открыть в Картах» должны оставаться доступными.'],
      sources:[['Условия','https://yandex.ru/legal/maps_api/ru/'],['JS тариф','https://yandex.ru/dev/tariffs/doc/ru/jsapi/prices/'],['Router тариф','https://yandex.ru/dev/tariffs/doc/ru/router/prices/'],['JS v3','https://yandex.ru/maps-api/docs/js-api/common/quickstart.html'],['Методы API','https://yandex.ru/maps-api/docs/js-api/ref/index.html']],
    },
  ];
  return { checked, profiles, get:id=>profiles.find(p=>p.id===id) };
});
