function n(r){let e=async t=>"handler"in r?r.handler(t.request):r(t.request);return{GET:e,POST:e}}export{n as toSolidStartHandler};
