(() => {
  const E=MapugaEconomics,$=id=>document.getElementById(id);
  const fields=[
    ['dau','Активных пользователей в день',100,1,1000000,1],['days','Дней в месяце',30,1,31,1],['adsPerDau','Рекламных возможностей / DAU / день',2,0,30,.1],['fill','Заполнение рекламой, %',80,0,100,1],['eligibleShare','Монетизируемая доля аудитории, %',100,0,100,1],['ecpm','Условный eCPM издателя, $',.75,0,100,.05],['sessions','Открытий карты / DAU / день',1,0,30,.1],['routes','Маршрутов / DAU / день',1,0,30,.1],['points','Точек в маршруте, включая старт',4,2,20,1],['newAddressShare','Доля точек с новым поиском, %',100,0,100,1],['queriesPerAddress','Autocomplete-запросов на выбор адреса',3,1,30,1],['abandonedQueriesPerDau','Доп. запросов без выбора / DAU / день',0,0,100,1],['tilesPerSession','Тайлов на открытие карты',40,0,2000,1],['infra','Сервер/хостинг в месяц, $ — допущение',0,0,10000,1],['gisQuote','Полная цена 2ГИС / месяц, $ — если известна','',0,100000,1],['yandexQuote','Полная цена Яндекса / месяц, $ — если известна','',0,100000,1],
  ];
  const wrap=$('calculator-fields');
  for(const[id,label,value,min,max,step]of fields){const field=document.createElement('label');field.className='lab-field';field.append(document.createTextNode(label));const input=document.createElement('input');input.id=id;input.type='number';input.value=value;input.min=min;input.max=max;input.step=step;if(value==='')input.placeholder='Неизвестно — не считать нулём';input.addEventListener('input',render);field.append(input);wrap.append(field);}
  const money=n=>n===null?'Нужен полный тариф':new Intl.NumberFormat('ru',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
  function assumptions(){const s={};for(const[id]of fields){const v=$(id).value;s[id]=v===''&&(id==='gisQuote'||id==='yandexQuote')?null:Number(v);}for(const id of['fill','eligibleShare','newAddressShare'])s[id]/=100;s.googleNative=$('google-native').checked;s.googleNavigation=$('google-navigation').checked;return s;}
  function cell(row,text,className){const td=document.createElement('td');td.textContent=text;if(className)td.className=className;row.append(td);}
  function render(){
    try{
      const s=assumptions();const result=E.calculate(s);$('calculator-error').hidden=true;
      $('revenue').textContent=money(result.revenue);$('impressions').textContent=Math.round(result.impressions).toLocaleString('ru');$('credits').textContent=Math.ceil(result.geoapify.dailyCredits).toLocaleString('ru');
      const body=$('cost-rows');body.replaceChildren();
      for(const[id,label]of[['geoapify','Geoapify'],['google','Google'],['2gis','2ГИС'],['yandex','Яндекс'],['osm','OSM demo']]){
        const r=result[id],tr=document.createElement('tr');cell(tr,label);cell(tr,money(r.apiCost));cell(tr,money(r.net),r.net===null?'':r.net>=0?'profit-positive':'profit-negative');cell(tr,r.breakEvenEcpm===null?'—':money(r.breakEvenEcpm));
        let note=id==='geoapify'?`${r.plan}; Free примерно до ${r.freeDauCapacity??'—'} DAU при этих допущениях. Лимит суточный, не суммарный месячный.`:id==='google'?r.note||`Карта ${money(r.items.maps)}, autocomplete ${money(r.items.autocomplete)}, details ${money(r.items.details)}, Routes ${money(r.items.routes)}, Navigation ${money(r.items.navigation)}.`:r.note;
        if(r.minimumRub)note=`От ${r.minimumRub.toLocaleString('ru')} ₽/месяц, без пересчёта валют. ${note}`;cell(tr,note);body.append(tr);
      }
      const scenarios=$('scenario-rows');scenarios.replaceChildren();for(const dau of[10,100,1000,10000]){const r=E.calculate({...s,dau}),tr=document.createElement('tr');cell(tr,dau.toLocaleString('ru'));cell(tr,money(r.revenue));cell(tr,`${r.geoapify.plan} · ${money(r.geoapify.apiCost)}`);cell(tr,money(r.geoapify.net),r.geoapify.net>=0?'profit-positive':'profit-negative');cell(tr,money(r.google.apiCost));cell(tr,money(r.google.net),r.google.net===null?'':r.google.net>=0?'profit-positive':'profit-negative');scenarios.append(tr);}
      $('formula-numbers').textContent=`${s.dau} × ${s.days} × ${s.adsPerDau} × ${s.fill} × ${s.eligibleShare} / 1000 × $${s.ecpm} = ${money(result.revenue)} в месяц`;
      $('api-volume').textContent=`За месяц: ${Math.round(result.mapLoads).toLocaleString('ru')} загрузок карты; ${Math.round(result.routeCalls).toLocaleString('ru')} маршрутов; ${Math.round(result.addresses).toLocaleString('ru')} выбранных адресов; ${Math.round(result.autocomplete).toLocaleString('ru')} оплачиваемых autocomplete-запросов Google. Geoapify: ${Math.ceil(result.geoapify.dailyCredits).toLocaleString('ru')} кредитов/сутки.`;
    }catch(error){$('calculator-error').hidden=false;$('calculator-error').textContent=error.message;}
  }
  $('google-native').addEventListener('change',render);$('google-navigation').addEventListener('change',render);
  for(const button of document.querySelectorAll('[data-ecpm]'))button.addEventListener('click',()=>{$('ecpm').value=button.dataset.ecpm;render();});
  render();
})();
