const express = require('express');
const bodyParser = require('body-parser');
const logger = require('morgan')
const request = require('request');
const crypto = require('crypto');
const urlencode = require('urlencode');

const app = express();
app.use(logger('dev'));
app.use(bodyParser.json());

// 免登
const AppKey = process.env.AppKey;
const AppSecret = process.env.AppSecret;
console.log('AppKey=' + AppKey);
console.log('AppSecret=' + AppSecret);

// 扫码
const ScanAppId = process.env.ScanAppId;
const ScanAppSecret = process.env.ScanAppSecret;
console.log('ScanAppId=' + ScanAppId);
console.log('ScanAppSecret=' + ScanAppSecret);

// userList
const userList = [{
  name: 'kyle',
  password: '111'
},
{
  name: 'zhang',
  password: '111'
}];

// deviceList
const deviceList = [{
  id: 1,
  name: 'device 1'
},
{
  id: 2,
  name: 'device 2'
}];

// api
app.get('/', function (req, res) {
  res.json({
    status:'success'
  });
});

// login
app.get('/api/login', function (req, res) {

  // check login
  let name = req.param('name');
  let password = req.param('password');

  if(!name || !password){
    res.sendStatus(401);
  }

  let users = userList.filter(e => {
    if(e.name == name && e.password == password){
      return true;
    } else {
      return false;
    }
  })

  if(!users || users.length != 1){
    res.sendStatus(401);
  } else {
    res.json({status: 'success', data: null});
  }

});

// query device
app.get('/api/device', function (req, res) {

  // check login
  let name = req.param('name');
  let password = req.param('password');

  if(!name || !password){
    res.sendStatus(401);
  }

  let users = userList.filter(e => {
    if(e.name == name && e.password == password){
      return true;
    } else {
      return false;
    }
  })

  if(!users || users.length != 1){
    res.sendStatus(401);
  }

  // query device
  let id = req.param('id');
  if(!id){
    res.sendStatus(400);
  }

  let devices = deviceList.filter(e => {
    if(e.id == id){
      return true;
    } else {
      return false;
    }
  })

  if(!devices || devices.length != 1){
    res.json({status: 'failed', message: '没有找到该设备, 设备id=' + id});
  } else {
    res.json({status: 'success', data: devices[0]});
  }

});

// get userinfo
app.get('/api/userinfo', function (req, res) {

  let code = req.param('code');
  console.log('code=' + code);

  let mode = req.param('mode');
  console.log('mode=' + mode);
  
  const headers = {};
  headers['Content-Type'] = 'application/json; charset=utf-8';

  if(mode == 'scan'){

    // 1. get nick + openid + unionid
    let accessKey = ScanAppId;
    let appSecret = ScanAppSecret;

    let hash_256 = crypto.createHmac("sha256",appSecret);
    let timestamp = Date.now();
    let signature = hash_256.update(Buffer.from('' + timestamp).toString("utf8"),'utf8').digest("base64");
    console.log("signature=", signature);
    let signatureEncoded =urlencode(signature);
    console.log("signatureEncoded=", signatureEncoded);

    let body = {
      tmp_auth_code: code
    };

    const options = {
      url: 'https://oapi.dingtalk.com/sns/getuserinfo_bycode?accessKey=' + accessKey + '&timestamp='+ timestamp +'&signature=' + signatureEncoded,
      json: true,
      headers: headers,
      body: body
    };
    
    let userinfo;
    request.post(options, function (error, response, body) {
              
      if(error || body.errcode){
        console.log('getuserinfo_bycode error', error, body.errcode, body.errmsg);
        res.json({status: 'failed', message: 'getuserinfo_bycode 失败, error message=' + body.errmsg});
      } else {
        userinfo = body;
        console.log('userinfo=' + userinfo);
        res.json({status: 'success', data: userinfo});  
      }

    });

    // 2. optional
    // get access token -> get userid(根据unionid获取userid) -> get userinfo
 
  } else if (mode == 'miandeng'){
    const options = {
      url: 'https://oapi.dingtalk.com/gettoken?appkey=' + AppKey + '&appsecret=' + AppSecret,
      json: true,
      headers: headers
    };
  
    // 1. get access token
    let access_token;
    let userid;
    let userinfo;
    request.get(options, function (error, response, body) {
      
      if(error || body.errcode){
        console.log('get access token error', error, body.errcode, body.errmsg);
        res.json({status: 'failed', message: '获取 access_token 失败, error message=' + body.errmsg});
      } else {
        
        // 2. get userid
        access_token = body.access_token;
        console.log('access_token=' + access_token);
        options.url = 'https://oapi.dingtalk.com/user/getuserinfo?access_token=' + access_token + '&code=' + code;
        
        request.get(options, function (error, response, body) {
      
          if(error || body.errcode){
            console.log('get userid error', error, body.errcode, body.errmsg);
            res.json({status: 'failed', message: '获取 userid 失败, error message=' + body.errmsg});
          } else {
            
            // 3. get userinfo
            userid = body.userid;
            console.log('userid=' + userid);
            options.url = 'https://oapi.dingtalk.com/user/get?access_token=' + access_token + '&userid=' + userid;
            
            request.get(options, function (error, response, body) {
              
              if(error || body.errcode){
                console.log('get userinfo error', error, body.errcode, body.errmsg);
                res.json({status: 'failed', message: '获取 userinfo 失败, error message=' + body.errmsg});
              } else {
                userinfo = body;
                console.log('userinfo=' + userinfo);
                res.json({status: 'success', data: userinfo});  
              }

            });
            // end 3. get userinfo
          }
            
        });
        // end 2. get userid
      }
        
    });
    // end 1. get access token
  }

});


// http://localhost:3000/static/
app.use('/static/',express.static('public'));

app.use(function (req, res, next) {
    const error = new Error('Not Found');
    error.status = 404;
    next(error);
});

app.use(function (error, req, res, next) {
    console.log('error=', error);
    res.status(error.status || 500);
    res.json(error);
});

app.listen(3000, function () {
    console.log('running at 3000...');
});
