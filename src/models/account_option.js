var BipModel = require('./prototype.js').BipModel;

var AccountOption = Object.create(BipModel);

AccountOption.entityName = 'account_option';
AccountOption.uniqueKeys = ['owner_id'],

    AccountOption.entitySchema = {
        id: {
            type: String,
            renderable: true,
            writable: false
        },
        owner_id : {
            type: String,
            renderable: false,
            writable: false
        },

        bip_hub: {
            type: Object,
            renderable: true,
            writable: true,
            validate : [
                {
                    // not a very good validator, but will do for know.  
                    // @todo ensure edge > vertex > edge doesn't exist. linked list,
                    // tortoise+hare is fine.'
                    validator : function(hub, next) {
                        var numEdges, edges = {}, edge, loop = false;
                        for (key in hub) {
                            edges[key] = 1;
                            numEdges = hub[key].edges.length;
                            for (var i = 0; i < numEdges; i++ ) {
                                edge = hub[key].edges[i];

                                if (!edges[edge]) {
                                    edges[edge] = 1;
                                } else {
                                    edges[edge]++;
                                    break;
                                }
                            }
                        }

                        for (edge in edges) {
                            loop = edges[edge] > 2;
                            if (loop) {
                                break;
                            }
                        }

                        next(!loop);                    
                    },
                    msg : "Routing Loop Detected"
                },
                {
                    validator : function(val, next) {
                        var ok = false,
                        userChannels = this.getAccountInfo().user.channels,
                        numEdges,
                        transforms;

                        // check channels + transforms make sense
                        if (undefined != val.source) {

                            // http can have dynamic exports, so inject them
                            if (this.type == 'http' && this.config.exports) {
                                var expLen = this.config.exports.length;
                                if (expLen > 0) {                        
                                    for (var i = 0; i < expLen; i++) {
                                        localExports[this.config.exports[i]] = {
                                            type : 'string'
                                        }
                                    }
                                }
                            }

                            for (var channelSource in val) {
                                // check channel exists
                                ok = (channelSource == 'source' || userChannels.test(channelSource));

                                if (ok) {
                                    // check edges point to channels for this account
                                    numEdges = val[channelSource].edges;
                                    if (numEdges > 0) {
                                        for (var e = 0; e < numEdges; e++) {
                                            ok = userChannels.test(val[channelSource].edges[e]);
                                            if (!ok) {
                                                break;
                                            }
                                        }
                                    }
                                }


                                if (!ok) {
                                    break;
                                }
                            }
                        }

                        next(ok);
                    },
                    msg : 'Bad Channel in Hub'
                }
            ]
        },
        bip_domain_id: {
            type: String,
            renderable: true,
            writable: true,
            validate : [ {
                validator : function(val, next) {
                    next(this.getAccountInfo().user.domains.test(val));
                },
                msg : 'Domain Not Found'
            }]
        },
        bip_end_life: {
            type: Object,
            renderable: true,
            writable: true,
            set : endLifeParse,
            validate : [{
                validator : function(val, next) {
                    console.log(val);
                    next(
                        (parseFloat(val.imp) == parseInt(val.imp)) && !isNaN(val.imp) &&
                        ((parseFloat(val.time) == parseInt(val.time)) && !isNaN(val.time)) ||
                          0 !== new Date(Date.parse(val.time)).getTime()
                    );
                },
                msg : 'Bad Expiry Structure'
            }]
        },
        bip_type: {
            type: String,
            renderable: true,
            writable: true,
            validate : [
                {
                    validator : function(val, next) {
                        next( /^(smtp|http|trigger)$/i.test(val) );
                    },
                    msg : 'Expected "smtp", "http" or "trigger"'
                }    
            ]
        },
        /*
        bip_anonymize: {
            type: Boolean,
            renderable: true,
            writable: true
        },
        */
        bip_expire_behaviour: {
            type: String,
            renderable: true,
            writable: true,
            validate : [
                {
                    validator : function(val, next) {
                        next( /^(pause|delete)$/i.test(val) );
                    },
                    msg : 'Expected pause" or "delete"'
                }    
            ]
        },
        timezone: {
            type: String,
            renderable: true,
            writable: true
        },
        avatar: {
            type: String,
            renderable: true,
            writable: true
        },
        default_feed_id : {
            type: String,
            renderable: true,
            writable: false
        }        
    };

/**
 * Validation
 */
AccountOption.entityValidators = {
    'bip_type' : [
    function(val, next) {
        next( /^(smtp|http|trigger)$/i.test(val) );
    },
    'Expected "smtp", "http" or "trigger"'
    ],    
    'bip_anonymize' : [ BipModel.validators.bool_int, 'Expected "1" or "0"']
//    'paused' : [ BipModel.validators.bool_int, 'Expected "1" or "0"']
//    'domain_id' : [ 'domains', 'Not Found' ]

}

AccountOption.preSave = function(accountInfo, oldModel) {
    // if the model avatar entity is a tainted external URL, then normalize it and
    // fire off a job to pull down an updated URL
    if ('' == this.avatar) {
        this.avatar = oldModel.avatar;
    }

    if (!/^\/static\/img\/cdn\/av\//.test(this.avatar) || (this.avatar != oldModel.avatar && /^http/.test(this.avatar) )) {                
        this._dao.getAvRemote(this.owner_id, this.avatar, true, function(err, result) {
            console.log(err);
        });
        this.avatar = '/static/img/cdn/av/' + this.owner_id + '.jpg';
    }
}

function endLifeParse(end_life) {
    if (isNaN(parseInt(end_life.imp))) {
        end_life.imp = 0;
    }
    
    if (end_life.time === '') {
        end_life.time = 0;        
    }
    return end_life;
}

module.exports.AccountOption = AccountOption;