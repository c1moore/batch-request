// header options tests

process.env.NODE_ENV = 'test';

var _ = require('lodash'),
    Chance = require('chance'),
    chance = new Chance(),
    expect = require('chai').expect,
    methods = require('methods'),
    request = require('supertest');

describe('Header Options', function() {
    var app;

    describe('defaultHeaders', function() {
        before(function(done) {
            app = require('./helpers/app')({
                defaultHeaders: {
                    'default1': 'default1_value'
                }
            });

            done();
        });

        after(function(done) {
            app.server.close(done);
        });

        it('Header default1', function(done) {
            request(app)
                .post('/batch')
                .send({
                    getHeader: {
                        url: 'http://localhost:3000/header/default1'
                    }
                })
                .expect(200, function(err, res) {
                    expect(err).to.not.exist;
                    expect(res.body).to.have.property('getHeader');
                    expect(res.body.getHeader.statusCode).to.equal(200);
                    expect(res.body.getHeader.body.value).to.be.a('string');
                    expect(res.body.getHeader.body.value).to.be.equal('default1_value');
                    done();
                });
        });

        it('Header default2 does not exist if no default set', function(done) {
            request(app)
                .post('/batch')
                .send({
                    getHeader: {
                        url: 'http://localhost:3000/header/default2'
                    }
                })
                .expect(200, function(err, res) {
                    expect(err).to.not.exist;
                    expect(res.body).to.have.property('getHeader');
                    expect(res.body.getHeader.statusCode).to.equal(404);
                    done();
                });
        });
    });

    describe('forwardHeaders', function() {
        before(function(done) {
            app = require('./helpers/app')({
                forwardHeaders: ['forward1', 'dependency1']
            });

            done();
        });

        after(function(done) {
            app.server.close(done);
        });

        it('Header forward1 exists', function(done) {
            request(app)
                .post('/batch')
                .set('forward1', 'forward1_value')
                .send({
                    getHeader: {
                        url: 'http://localhost:3000/header/forward1'
                    }
                })
                .expect(200, function(err, res) {
                    expect(err).to.not.exist;
                    expect(res.body).to.have.property('getHeader');
                    expect(res.body.getHeader.statusCode).to.equal(200);
                    expect(res.body.getHeader.body.value).to.be.a('string');
                    expect(res.body.getHeader.body.value).to.be.equal('forward1_value');
                    done();
                });
        });

        it('Header forward1 does not exist if not provided', function(done) {
            request(app)
                .post('/batch')
                .send({
                    getHeader: {
                        url: 'http://localhost:3000/header/forward1'
                    }
                })
                .expect(200, function(err, res) {
                    expect(err).to.not.exist;
                    expect(res.body).to.have.property('getHeader');
                    expect(res.body.getHeader.statusCode).to.equal(404);
                    done();
                });
        });

        it('Headers for both calls exist when dependency exists', function(done) {
            request(app)
                .post('/batch')
                .set('forward1', 'forward1_value')
                .set('dependency1', 'dependency1_value')
                .send({
                    getHeader: {
                        url: 'http://localhost:3000/header/forward1',
                        dependency: 'dependencyEndpoint'
                    },
                    dependencyEndpoint: {
                        url: 'http://localhost:3000/header/dependency1'
                    }
                })
                .expect(200, function(err, res) {
                    expect(err).to.not.exist;
                    expect(res.body).to.have.property('getHeader');
                    expect(res.body.getHeader.statusCode).to.equal(200);
                    expect(res.body.getHeader.body.value).to.be.a('string');
                    expect(res.body.getHeader.body.value).to.be.equal('forward1_value');

                    expect(res.body).to.have.property('dependencyEndpoint');
                    expect(res.body.dependencyEndpoint.statusCode).to.equal(200);
                    expect(res.body.dependencyEndpoint.body.value).to.be.a('string');
                    expect(res.body.dependencyEndpoint.body.value).to.be.equal('dependency1_value');

                    done();
                });
        });
    });

    describe('inheritHeaders', function() {
        var createServer;
        var defaultHeaders;
        var requestBody;

        beforeEach(function() {
            createServer = function createServer(inheritHeaders) {
                app = require('./helpers/app')({
                    defaultHeaders: defaultHeaders,
                    inheritHeaders: inheritHeaders
                });
            };

            defaultHeaders = {
                default1:   'default_value1',
                default2:   'default_value2'
            };

            requestBody = {
                request1:   {
                    url:        'http://localhost:3000/header/bounce'
                }
            };
        });

        afterEach(function(done) {
            app.server.close(done);
        });

        it('should skip inheriting headers when inheritHeaders is not specified', function(done) {
            createServer();

            request(app)
                .post('/batch')
                .set('Parent-Header', 'Parent_Only')
                .send(requestBody)
                .expect(200, function(error, res) {
                    expect(error).to.not.exist;

                    expect(res.body).to.have.property('request1');
                    expect(res.body.request1.body).to.not.have.property('Parent-Header');

                    done();
                });
        });

        it('should skip inheriting headers when inheritHeaders is false', function(done) {
            createServer(false);

            request(app)
                .post('/batch')
                .set('Parent-Header', 'Parent_Only')
                .send(requestBody)
                .expect(200, function(error, res) {
                    expect(error).to.not.exist;

                    expect(res.body).to.have.property('request1');
                    expect(res.body.request1.body).to.not.have.property('Parent-Header');

                    done();
                });
        });

        it('should skip headers that start with "Content-"', function(done) {
            createServer(true);

            request(app)
                .post('/batch')
                .set('Content-X-Type', 'Do NOT Inherit!')
                .send(requestBody)
                .expect(200, function(error, res) {
                    expect(error).to.not.exist;

                    expect(res.body).to.have.property('request1');
                    expect(res.body.request1.body).to.not.have.property('Content-X-Type');

                    done();
                });
        });

        it('should skip headers that are redefined in the individual request', function(done) {
            createServer(true);

            requestBody.request1.headers = {
                'overridden-header':    'Child Value'
            };

            request(app)
                .post('/batch')
                .set('overridden-header', 'Parent Value')
                .send(requestBody)
                .expect(200, function(error, res) {
                    expect(error).to.not.exist;

                    expect(res.body).to.have.property('request1');
                    expect(res.body.request1.body).to.have.property('overridden-header').which.equals(requestBody.request1.headers['overridden-header']);

                    done();
                });
        });

        it('should add all other headers that are not defined in individual requests', function(done) {
            var sharedCookieValue = 'Everybody\'s Cookie!';

            createServer(true);

            request(app)
                .post('/batch')
                .set('shared-cookie', sharedCookieValue)
                .send(requestBody)
                .expect(200, function(error, res) {
                    expect(error).to.not.exist;

                    expect(res.body).to.have.property('request1');
                    expect(res.body.request1.body).to.have.property('shared-cookie').which.equals(sharedCookieValue);

                    done();
                });
        });

        it('should override default headers', function(done) {
            var newDefaultValue = 'NotDefault';

            createServer(true);

            request(app)
                .post('/batch')
                .set('default1', newDefaultValue)
                .set('default2', newDefaultValue)
                .send(requestBody)
                .expect(200, function(error, res) {
                    expect(error).to.not.exist;

                    expect(res.body).to.have.property('request1');
                    expect(res.body.request1.body).to.have.property('default1').which.equals(newDefaultValue);
                    expect(res.body.request1.body).to.have.property('default2').which.equals(newDefaultValue);

                    done();
                });
        });
    });
});
