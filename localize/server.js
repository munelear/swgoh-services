// init project
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    req.ip = req.headers['x-forwarded-for'] 
        ? req.headers['x-forwarded-for'].split(/\s*,\s*/)[0] 
        : req.connection.remoteAddress;
    req.ip = req.ip.replace('::ffff:','');
    //console.log('>> '+req.ip+" >> "+req.url)
    next();
});

//Expects any json with localization key values
var localizationStrings = {}
app.use('/lang/:language', bodyParser.json({limit:'50mb'}), async (req, res) => {
    try {
        var dstr = JSON.stringify(req.body)
        var lang = (req.params.language || 'eng_us').toUpperCase()
        
        if( !localizationStrings[lang] ) {
            localizationStrings[lang] = JSON.parse((require('fs').readFileSync("../common/data/"+lang+".json")).toString())
            localizationStrings[lang].sort((a,b) => b.id.length - a.id.length)
        }
        
        var strings = localizationStrings[lang].filter(s => dstr.includes(s.id))        
        strings.forEach(s => {
            dstr = dstr.replace(new RegExp( JSON.stringify(s.id), 'gm' ), JSON.stringify(s.value))
        })
        strings = null
        
        res.write( JSON.stringify(JSON.parse(dstr)) )        
    } catch(e) {
        res.write(JSON.stringify({ error:e.message }))
        console.log(e)
    }
    return res.end()
})

app.use('/update/:language', (req, res) => {
    var lang = (req.params.language || 'eng_us').toUpperCase()
    localizationStrings[lang] = JSON.parse((require('fs').readFileSync("../common/data/"+lang+".json")).toString())
    localizationStrings[lang].sort((a,b) => b.id.length - a.id.length)
})

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
    console.log(`Localizer is listening on port ${listener.address().port}`)
})
