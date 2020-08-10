const express = require('express'),
  multer = require('multer'),
  upload = multer(),
  app = express(),
  got = require('got'),
  port = 42069;

app.use(express.static('static'));
app.use(express.urlencoded({extended: false}));

app.post('/formstuffer/minneapolis/ward', upload.none(), async (req, res, next) => {
  console.log('form submit: ', req.body);

  const domain = 'http://apps.ci.minneapolis.mn.us';

  try {
    // first grab the form page from the city of minneapolis ward lookup page
    // we need to do this because they use cookies to track the form state...
    // those cookies are required in order to do anything useful
    const response = await got(`${domain}/AddressPortalApp/Search?AppID=WardFinderApp`);

    let cookieJar = [];

    for (const cookie of response.headers['set-cookie'])
      cookieJar.push(cookie.replace(/\;.*/ig, ''));
    
    // stick our cookies into a HTTP header blob that looks like a web browser
    const url = 'http://apps.ci.minneapolis.mn.us/AddressPortalApp/Search/SearchPOST?AppID=WardFinderApp',
      headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.105 Safari/537.36',
        'Origin': domain,
        'Referer': `${domain}/AddressPortalApp/Search?AppID=WardFinderApp`,
        'Cookie': cookieJar,
      };

    // now do the address search on the city of minneapolis lookup tool
    const response2 = await got.post(url, {
      form: {Address: req.body.address},
      headers: headers,
      followRedirect: false
    });
    
    let redirect = response2.headers.location;

    // if the user entered an ambiguous address then we'll get a table of results
    // we'll have to parse the table (assume the first result is a good one)
    if (redirect.indexOf('&APN=') === -1) {

      console.log(' - direct location match not found, falling back to secondary lookup...');

      const response3 = await got(domain + response2.headers.location, { headers, followRedirect: false });

      redirect = /App.RedirectLink\(\'(.*)\'\)/g.exec(response3.body)[1].replace('&amp;', '&');
    }

    // either way now we have an "APN", which we can use to find the user's ward
    const response4 = await got(domain + redirect, { headers, followRedirect: false });

    // GOT IT!
    const ward = /\/(ward\d+)\//.exec(response4.headers.location)[1];    

    console.log('ward: ', ward);

    res.send(ward);

  } catch(error) {
    console.error('ERROR: ', error);
    res.status(500).send(error.response ? error.response.body : error);
  }
});

app.listen(port, () => {
  console.log(`RT4Tools listening on port ${port}`);
});