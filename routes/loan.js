var express = require('express');
var moment = require('moment');
var router = express.Router();
var Book = require('../models').books;
var Patron = require('../models').patrons;
var Loan = require('../models').loans;

/** Used to control pagination */
var pagination = {
  limit: 10,
  offset: 0,
  order: 'title',
  search: '%',
  numRecords: 0,
  numPages: 1
};

/** GET home page */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Library Manager' });
});

/** GET list of all loans */
router.get('/loans/all', function(req, res, next) {
  var order;
  getPaging(req.query, pagination, function() {
    console.log('-----------ROUTER:', pagination);
    if (pagination.order === 'name') {
      order = "`last_name`, 'ASC', `first_name`, 'ASC'"; 
    } else {
      order = pagination.order;
    }
    Loan.findAll({
        order: order,
        include: [ Book, Patron ],
        limit: pagination.limit,
        offset: pagination.offset
      })
      .then(function(loans) {
        var pastDue = moment().format('YYYY-MM-DD');
        res.render('all-loans', { loans: loans, pagination: pagination, pastDue: pastDue, title: 'Loans' });
      });
  });
});

/** GET All loans that are overdue */
router.get('/loans/overdue', function(req, res, next) {
  var order;
  getPaging(req.query, pagination, function() {
    console.log('-----------ROUTER:', pagination);
    if (pagination.order === 'name') {
      order = "`last_name`, 'ASC', `first_name`, 'ASC'"; 
    } else {
      order = pagination.order;
    }
    Loan.findAll({
      order: order,
      include: [ Book, Patron ],
      where: {
        return_by: {
          $lt: moment().format('YYYY-MM-DD')
        },
        returned_on: null
      },
      limit: pagination.limit,
      offset: pagination.offset
    }).then(function(loans) {
        var loanList = JSON.parse(JSON.stringify(loans));
        res.render('loans-overdue', {loans: loans, pagination: pagination, title: 'Overdue Loans'});
    });
  });
});

/** GET All loans that are checked out */
router.get('/loans/out', function(req, res, next) {
  var order;
  getPaging(req.query, pagination, function() {
    console.log('-----------ROUTER:', pagination);
    if (pagination.order === 'name') {
      order = "`last_name`, 'ASC', `first_name`, 'ASC'"; 
    } else {
      order = pagination.order;
    }
    Loan.findAll({
      order: order,
      include: [ Book, Patron ],
      where: {
        '$book.status$': 'OUT',
        returned_on: null
      },
      limit: pagination.limit,
      offset: pagination.offset
    }).then(function(loans) {
        var loanList = JSON.parse(JSON.stringify(loans));
        var pastDue = moment().format('YYYY-MM-DD');
        //console.log("PAST DUE ", pastDue, ' ', bookList[0].loans[0].return_by, ' ', bookList[0].loans[0].return_by < pastDue);
        res.render('loans-out', {loans: loanList, pagination: pagination, pastDue: pastDue, title: 'Checked-out Loans'});
    });
  });
});


/** GET Adding a new loan -- display the form */
router.get('/loans/new', function(req, res, next) {
    var bookList;
    Book.findAll({
          attributes: [ 'id', 'title' ],
          order: [['title', 'ASC']],
          where: {
              status: 'IN'
          }
        })
    .then(function(books) {
        bookList = books;
    }).then(function() {
        Patron.findAll({order: [['last_name', 'ASC']] })
        .then(function(patrons) {
            res.render('new-loan', { 
                loan: Loan.build(), 
                books: bookList, 
                patrons: patrons,
                title: 'New Loan' 
            });
        });
    });
});

/** GET Loan by id */
router.get('/return/:id', function(req, res, next) {
    Loan.findAll({
      include: [ Book, Patron ],
      where: {
        '$book_id$': req.params.id,
        returned_on: null
      }
    }).then(function(loan) {
      loan[0].returned_on = moment().format('YYYY-MM-DD');
      res.render('return-book.jade', { loan: loan[0], title: 'Return Book'});
    });
});

/** POST Create a new loan in database */
router.post('/loans/add', function(req, res, next) {
  Loan.create(req.body).then(function(loan) {
      Book.updateStatus(loan.book_id);
      res.redirect('/loans/all');
  });
});

/** PUT Return book */
router.put('/return/:id', function(req, res, next) {
  Loan.findOne({ 
      include: [{ model: Book }],
      where: {
        id: req.params.id
      }
    }).then(function(loan) {
        var bookId = loan.book.id;
        console.log('BOOK ID: ', bookId);
        Book.update({ status: 'IN' }, {
            where: {
                id: bookId
            }
        });
    }).then(function() {
          Loan.update({ returned_on: req.body.returned_on }, {
                where: {
                    id: req.params.id
                }
          });
        }).then(function(loan) {
                res.redirect('/loans/all');
        }).catch(function(error) {
            res.status(500).send(error);
        });
});

/** 
 * FUNCTION getPaging
 *    Sets the paging object to control pagination 
 * 
 *    @param {object} query - query parameters from url
 *    @param {paging} paging contains pertinent control attributes for pagination
 *    @return callback function
 */ 
function getPaging(query, paging, callback) {
    console.log('----------getPaging query: ', query);
    if (query.offset) {
      paging.offset = query.offset;
    }
    if (query.order) {
       paging.order = query.order;
    }
    if (query.search && query.search !== paging.search) {
      paging.search = query.search + '%';
    }
    Loan.count().then(function(count) {
      paging.numRecords = count;
      paging.numPages = Math.ceil(paging.numRecords / paging.limit);
      console.log("-------------getPaging PAGING: ", paging);
      callback();
    });
  }

module.exports = router;
