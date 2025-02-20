const sql = require("better-sqlite3/lib/database");
const {
    get:_get,
    set:_set,
    remove,
    merge,
    isArray,
    isNil
} = require("lodash");
const fs = require("fs");
const colors = require("colors")
const { resolve, sep } = require('path');
class Database {
    #dataDir
    #name
    #db
    /**
     * 
     * @param {*} options.name set a name to a database
     * @param {*} options.dataDir set a path for a database
     * @param {"false","hour","daily","weekly","monthly"} options.backupinterval set a backupinterval
     * @example 
     * let db = new Database() // use default settings
       
       let db = new Database({name:"my_database"}) // set costume name

       let db = new Database({dataDir:"./databse",name:"my_database",backupinterval:false}) // all settings
       
     */
    constructor(options = {}){
        this.#name = options.name || "sql";
        this.#dataDir = resolve(process.cwd(), options.dataDir || 'data');
        if(fs.existsSync(this.#dataDir) == false & this.#dataDir.endsWith("data") == true){
            try {
                fs.mkdirSync(this.#dataDir);
            } catch (error) {
                
            }
        }
        if(fs.existsSync(this.#dataDir) == false){
            process.emitWarning(`cannot open ${this.#dataDir}`, {
                code: '',
                detail: 'cannot open datadir we use ram now'
              })
        }
        this.#db  = new sql(this.#dataDir+"/simpledb.sqlite",{verbose: null});
        this.#db.prepare(`CREATE TABLE IF NOT EXISTS "${this.#name}" ("key" VARCHAR(255) PRIMARY KEY, "value" TEXT)`).run();

    }
    /**
     * get the Database as array format
     * @returns []
     */
    get array(){
        return this.all()
        // this.#db.prepare(`SELECT * FROM ${this.#name}`).all()
    }
    /**
     * get all indexes of the database
     * @returns {}
     */
    all(){
        return this.#db.prepare(`SELECT * FROM ${this.#name}`).all().map(d=>JSON.parse(_get(d,"value")).value) || {};
    }
    /**
     * get a index from database
     * @param {*} key set the key to select
     * @param {*} path set the path
     * @returns {}
     * @example 
       db.get("user-david") //get a index

       db.get("user-david","email") //get a index of a path
     */
    get(key,path = null){
        if(path == null){
            let dbcontent = this.#db.prepare(`SELECT * FROM ${this.#name} WHERE key = ?`).get(`keyv:${key}`);
            return dbcontent ? JSON.parse(dbcontent.value).value : {};
        } else {
            let dbcontent = this.get(key);
            let res = _get(dbcontent,path);
            return res;
        }
    }
    /**
     * set a key/path of the Database
     * @param {*} key set the key to select
     * @param {*} value set a value 
     * @param {*} path set the path
     * @returns {}
     * @example
       db.set("user-david",{username:"david"}) // set a index

       db.set("user-david","david","username") // set a index of a path
     */
    set(key,value,path = null){
        if(path == null){
            this.delete(key)
            this.#db.prepare(`INSERT INTO ${this.#name} (key, value) VALUES (?, ?)`).run(`keyv:${key}`, JSON.stringify({
            value: value,
            expires: null
          }));
        } else {
            let dbcontent = this.get(key);
            if(!dbcontent) return null;
            let res = _set(dbcontent,path,value);
            this.delete(key)
            this.#db.prepare(`INSERT INTO ${this.#name} (key, value) VALUES (?, ?)`).run(`keyv:${key}`, JSON.stringify({
                value: res,
                expires: null
              }));
        }
         
          //::memory::
    }
    /**
     * delete a key/path of the Database
     * @param {*} key set key to delete
     * @param {*} path set path to delete
     * @returns {}
     * @example 
       db.delete("user-david") // delete a user

       db.delete("user-david","email") // delete a path of a user
     */
    delete(key,path = null){
        if(path == null){
            this.#db.prepare(`DELETE FROM ${this.#name} WHERE key=?`).run(`keyv:${key}`);
        } else {
            let dbcontent = this.get(key);
            let res = _set(dbcontent,path,undefined);
            this.delete(key);
            this.set(key,res);
        }
    }
    /**
     * ensure a key/path of the Database
     * @param {*} key 
     * @param {*} value 
     * @param {*} path 
     * @returns
     * @example 
       db.ensure("user-david",{username:"david"}) // ensure a user

       db.ensure("user-david",{icon:"https://imegur.com/ahdagwd"},"profiel") // ensure a path of a user
     */
    ensure(key,value,path = null){
        if(path == null){
            let dbcontent = this.get(key);
            let res = merge(dbcontent,value);
            this.delete(key);
            this.set(key,res);
        } else {
            let dbcontent = this.get(key);
            let res = _set(dbcontent,path,merge(_get(dbcontent,path),value));
            this.delete(key);
            this.set(key,res);
        }
    }
    /**
     * push
     * @param {*} key set a key to push
     * @param {*} value set a value to push
     * @param {*} path set a path to push
     * @returns {}
     */
    push(key,value,path = null){
        if(path == null){
            let dbcontent = this.get(key);
            if(!isArray(dbcontent)) return console.log(`its not a array \n ${dbcontent}`.red);
            dbcontent = dbcontent.push(value);
            console.log(dbcontent)
            this.delete(key);
            this.set(key,dbcontent)
        } else {
            let dbcontent = this.get(key);
            let tocheck = _get(dbcontent,path);
            if(!isArray(tocheck)) return console.log(`its not a array \n ${dbcontent}`.red);
            tocheck = tocheck.push(value);
            this.delete(key);
            this.set(key,tocheck)
        }
    }
    /**
     * check if a key/path exist in the db
     * @param {*} key set a key to check
     * @param {*} path set a path to check
     * @returns true||false
     * @example
       db.has("user-david") // check if the key exist

       db.has("user-david","email") // check if a path exist
     */
    has(key,path = null){
        if(path == null){
            let dbcontent = this.#db.prepare(`SELECT * FROM ${this.#name} WHERE key = ?`).get(`keyv:${key}`);
            dbcontent = dbcontent ? true : false;
            return dbcontent;
        } else {
            let dbcontent = this.get(key);
            let exist = !_get(dbcontent,path) ? false : true;
            return exist;
        }
    } 
    update(key,value,path = null){
        
    }
    
}
module.exports.sqldb = (options) => {return new Database(options)}
