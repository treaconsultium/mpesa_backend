const request = require('request');
const fs = require('fs');
const prettyjson = require('prettyjson');
const pdf = require('html-pdf');
const pdfTemplate = require('./document/index');

class Router {
    constructor(app, db, loggerr){
        this.pay(app, db, loggerr);
    }


    //route
    //login method route
    pay(app, db, loggerr){
        app.post('/pay', acc_token, (req, res)=>{
            let amt = req.body.amount;
            let phone_number = req.body.phone_number;
            //let paybill_no = req.body.paybill_no;
            let date_ob= new Date();
            //get the current date
            let date = ("0"+ date_ob.getDate()).slice(-2);
            //get the current month
            let month = ("0"+(date_ob.getMonth()+1)).slice(-2);
            //get the current year
            let year = date_ob.getFullYear();
            //get the current hours
            let hours =("0"+date_ob.getHours()).slice(-2);
            //get current minutes
            let minutes = ("0"+date_ob.getMinutes()).slice(-2);
            //get current seconds
            let seconds = ("0"+date_ob.getSeconds()).slice(-2);
            //print date
            const entry_dat = year+ "-" +month+ "-" +date+ " " +hours+ ":" +minutes+ ":" +seconds;
            const dttw = year+month+date+hours+minutes+seconds;
            let fhh =dttw.toString()

          let sql_query = "SELECT * FROM stk_push LIMIT 1";
          db.query(sql_query, (err, data, fields) => {
            if(data && data.length === 1 ){
              let passkey = data[0].Pass_key;
              let bill_no = data[0].Bill_number;
              let stk_url = data[0].Stkpush_url;
              let trans_type = data[0].Transaction_type;
              let callback_url = data[0].Callback_url;
              let acc_ref = data[0].Account_ref;
              let trans_desc = data[0].Transaction_desc;
              let paskey = passkey;
              let pass = new Buffer.from(bill_no+paskey+fhh).toString("base64");
              loggerr.info('STK details retrieved successfully')
                
              const options= {
                noColor:true
              };
    
              let ouths= req.access_token;
              const uri =stk_url
              const auths = "Bearer " + ouths
              request(
                {
                  method: 'POST',
                  url : uri,
                  headers : {
                    "Authorization" : auths
                  },
                  json : {
                    "BusinessShortCode": bill_no,
                    "Password": pass,
                    "Timestamp": fhh,
                    "TransactionType": trans_type,
                    "Amount": amt,
                    "PartyA": "254"+phone_number,
                    "PartyB": bill_no,
                    "PhoneNumber": "254"+phone_number,
                    "CallBackURL": callback_url,
                    "AccountReference": acc_ref ,
                    "TransactionDesc": trans_desc
                  }
                },
                (error, response, body)=>{
                                
                  loggerr.info('-----Recieved MPesa webhook----');
                  loggerr.info(prettyjson.render(req.body, options));
                  let bdy= req.body
                  //pdfTemplate(bdy.MerchantRequestID)
                  //format and dump the request payload recieved from safaricom in the terminal
                  const obj = JSON.stringify(body);
                  const m = JSON.parse(obj);
                  const keyarrays = Object.keys(m);
                  for (var i = 0; i < keyarrays.length; i++) {
                    let find_key = keyarrays[i];
                    let valu = m[find_key];
                  }
                  let nn = m.CheckoutRequestID;
                  let cde =m.ResponseCode;
                  if ( cde === '0' ){
                    fs.readFile('userd.json', (err, data) => {
                      if (err){
                        loggerr.error(err)
                      }
                      try{
                        var jsondata = data;
                        var jsonparsed = JSON.parse(jsondata);
                        var merchant = jsonparsed.MerchantRequestID;
                        var checkout = jsonparsed.CheckoutRequestID;
                        var resdesc = jsonparsed.ResponseDescription;
                        var custmes = jsonparsed.CustomerMessage;
                        let quey ="INSERT INTO lipanampesa (MerchantRequestID, CheckoutRequestID, Result_code, Result_description, Customer_message, Entry_date) VALUES"+
                        "('"+merchant+"', '"+checkout+"', '"+cde+"', '"+resdesc+"', '"+custmes+"', '"+entry_dat+"')" ;
                           db.query(quey, (err, result, fields) => {
                              if(err){
                                loggerr.error(err);
                              }
                              res= fields;
                              loggerr.info('STK response saved to db and now waiting for customer response')
                           }); 
                      }
                      catch(e){
                        loggerr.error(e)
                      }
                      });
                      //response from the server
                      const writTotext = JSON.stringify(body);
                      fs.writeFile('userd.json', writTotext, (err) =>{
                        if(err){
                          loggerr.error(err);
                        }
                        loggerr.info('Server response out of the agents input')
                      });
                     loggerr.info('---------STK request sent successfully------')
                  } 
                   const serverresponse =JSON.stringify(req.body)
                   fs.writeFile('serverresp.json', serverresponse, (err) =>{
                    if(err){
                      loggerr.error(err);
                    }
                    loggerr.info('Server response after customer reaction captured on txt file')
                  });
                  //read now the server response and send to database
                 
                    fs.readFile('serverresp.json', (err, data) => {
                      if(err){
                        loggerr.error(err);
                      }
                      try{
                        var serverdata = data;
                        var parseddta = JSON.parse(serverdata);
                        var merc = parseddta.Body.stkCallback.MerchantRequestID;
                        var chec = parseddta.Body.stkCallback.CheckoutRequestID;
                        var resul = parseddta.Body.stkCallback.ResultCode;
                        var resuldesc = parseddta.Body.stkCallback.ResultDesc;
                        if(resul != '0'){
                          let cury = "INSERT INTO lipanampesa_attempts (MerchantRequestID, CheckoutRequestID, Result_code, Result_description, Entry_date) VALUES"+
                          "('"+merc+"', '"+chec+"', '"+resul+"', '"+resuldesc+"', '"+entry_dat+"')" ;
                          db.query(cury , (err, result, fields) => {
                            if(err){
                              loggerr.error(err);
                            }
                            loggerr.info('Customer has not responded positively. Details captured to database')
                            pdfTemplate(merc,chec,resul, resuldesc)
                          });
                        }
                        else if(resul=='0'){
                          var cash = parseddta.Body.stkCallback.CallbackMetadata.Item[0].Value;
                          var receipt = parseddta.Body.stkCallback.CallbackMetadata.Item[1].Value;
                          var transdate = parseddta.Body.stkCallback.CallbackMetadata.Item[3].Value;
                          var transphone = parseddta.Body.stkCallback.CallbackMetadata.Item[4].Value;
                          let cury_success = "INSERT INTO lipanampesa_success (MerchantRequestID, CheckoutRequestID, Result_code, Result_description, Amount, Receipt_No, Phone_Number,Transaction_date, Entry_date) VALUES"+
                          "('"+merc+"', '"+chec+"', '"+resul+"', '"+resuldesc+"','"+cash+"','"+receipt+"','"+transphone+"', '"+transdate+"', '"+entry_dat+"')" ;
                          db.query(cury_success , (err, result, fields) => {
                            if(err){
                              loggerr.error(err);
                            }
                            loggerr.info('Customer has responded positively and Details saved to database');
                            pdfTemplate(merc,chec, resul, resuldesc, cash, receipt, transphone, transdate)
                          });
                        }
                      }
                      catch(e){
                        loggerr.error(e)
                      }  
                    }); 
                   res.status(200).json({
                     success:true,
                     msg: 'Confirmed sent'
                   })
                }
              )
            }
            else{
              loggerr.error(err);
            }
          });
        });

        //POST - PDF generation and fetching of the data
        app.post('/create-pdf', (req, res) =>{
          pdf.create(pdfTemplate(req.body), {}).toFile('result.pdf', (err) =>{
              if(err){
                  res.send(Promise.reject());
              }
              res.send(Promise.resolve());
          });
        });

        //GET - send the generated pdf to client
        app.get('/fetch-pdf', (req, res) =>{
          res.sendFile(`${__dirname}/result.pdf`)
        });
      
        //access token function
        function acc_token(req, res, next){
          let sql = "SELECT Consumer_key, Consumer_secret, Token_generation_url FROM token_generation LIMIT 1";
          db.query(sql, (err, data, fields) => {
            if(data && data.length === 1){
              const con_secret = data[0].Consumer_secret;
              const con_key = data[0].Consumer_key;
              const tok_gen = data[0].Token_generation_url;
              let url = tok_gen
              let auth = "Basic " + new Buffer.from(con_key + ":" + con_secret).toString("base64");
              request(
                {
                  url : url,
                  headers : {
                    "Authorization" : auth
                  }
                },
                function (error, response, body) {  
                  const rey = JSON.parse(body);
                  req.access_token =rey.access_token;
                  loggerr.info('Access token acquired')
                  next()
                }
              ) 
            }
            else{
              loggerr.error(err);
            }
          });
        }
    }

}

module.exports = Router;