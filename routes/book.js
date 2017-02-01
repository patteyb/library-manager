var express = require('express');
var router = express.Router();
var moment = require('moment');
var Book = require('../models').books;
var Patron = require('../models').patrons;
var Loan = require('../models').loans;

/** Used to control pagination */
var pagination = {
  limit: 10,
  offset: 0,
  order: 'title',
  title: '%',
  author: '%',
  genre: '%',
  numRecords: 0,
  numPages: 1
};

var subtitle = '';

/** GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Library Manager' });
});

/** GET list of all books */
router.get('/books/all', function(req, res, next) {
  console.log('IN GET /books/all: ', req.query.searchOn, req.query.searchStr);
  getSearchAndOrder(req.query, pagination, function() {
    Book.findAndCountAll({
        order: [[pagination.order, 'ASC']],
        where: {
           title: {$like: pagination.title},
           author: {$like: pagination.author},
           genre: {$like: pagination.genre}
        },
        limit: pagination.limit,
        offset: pagination.offset
      })
      .then(function(books) {
        pagination.numRecords = books.count;
        pagination.numPages = Math.ceil(pagination.numRecords / pagination.limit);
        getSubtitle(req.query, function() {
          res.render('all-books', { 
            books: books.rows, 
            pagination: pagination, 
            title: 'Books', 
            subtitle: subtitle});
        });
      }); 
   });
});


/** GET Adding a new book -- display the form */
router.get('/books/new', function(req, res, next) {
  res.render('new-book', { book: Book.build(), title: "New Book" });
});

/** POST Create a new book in database */
router.post('/add', function(req, res, next) {
  Book.create(req.body).then(function() {
    res.redirect('/books/all?offset=0&order=title');
  }).catch(function(error) {
    if(error.name === "SequelizeValidationError") {
        res.render('new-book', { book: Book.build(), errors: error, title: "New Book" });
    }
  }); 
});

/** GET Book by ID */
router.get('/book', function(req, res, next) {
  Book.findAll({
    include: [{ model: Loan, include: [{ model: Patron }] }],
    where: {id: req.query.id }
  })
  .then(function(book) {
     var bookDetail = JSON.parse(JSON.stringify(book));
     res.render('book-edit', { book: bookDetail[0], title: "Edit Book" });
   });
});

/** PUT Update book in database */
router.put('/book/:id', function(req, res, next) {
  console.log('IN PUT: ', req.params.id);
  Book.findById(req.params.id).then(function(book) {
    if(book) {
      return book.update(req.body);
    } else {
      throw 500;
      //res.sendStatus(500);
    }
  }).then(function(book) {
    res.redirect('/books/all');
  }).catch(function(error) {
    var errors = error;
    if(error.name === "SequelizeValidationError") {
      Book.findAll({
        include: [{ model: Loan, include: [{ model: Patron }] }],
        where: {id: req.params.id }
      })
      .then(function(book) {
        var bookDetail = JSON.parse(JSON.stringify(book));
        res.render('book-edit', { book: bookDetail[0], errors: errors, title: "Edit Book" });
      });
    }
  }); 
});

/** GET All books that are overdue */
router.get('/books/overdue', function(req, res, next) {
  getSearchAndOrder(req.query, pagination, function() {
    Book.findAndCountAll({
      include: [{ 
        model: Loan, 
        where: {
          return_by: {
            $lt: new Date()
          },
          returned_on: null
        } 
      }],
      order: [[pagination.order, 'ASC']],
      where: {
           title: {$like: pagination.title},
           author: {$like: pagination.author},
           genre: {$like: pagination.genre}
        },
      limit: pagination.limit,
      offset: pagination.offset
      }).then(function(books) {
          pagination.numRecords = books.count;
          pagination.numPages = Math.ceil(pagination.numRecords / pagination.limit);
          getSubtitle(req.query, function() {
            res.render('books-overdue', {
              books: books.rows, 
              pagination: pagination, 
              title: 'Overdue Books', 
              subtitle: subtitle});
          });
      });
   });
});

/** GET All books that are checked out */
router.get('/books/out', function(req, res, next) {
  getSearchAndOrder(req.query, pagination, function() {
    Book.findAndCountAll({
      order: [[pagination.order, 'ASC']],
      include: [{ 
        model: Loan, 
        where: {
          returned_on: null
          } }],
      where: {
        status: 'OUT',
        title: {$like: pagination.title},
        author: {$like: pagination.author},
        genre: {$like: pagination.genre}
      },
      limit: pagination.limit,
      offset: pagination.offset
    }).then(function(books) {
       getSubtitle(req.query, function() {
          pagination.numRecords = books.count;
          pagination.numPages = Math.ceil(pagination.numRecords / pagination.limit);
          //var bookList = JSON.parse(JSON.stringify(books));
          var pastDue = moment().format('YYYY-MM-DD');
          res.render('books-out', {
            books: books.rows, 
            pastDue: pastDue, 
            pagination: pagination,
            title: 'Checked-out Books', 
            subtitle: subtitle
          });
       });
    });
  });
});

/** 
 * FUNCTION getSearchAndOrder
 *    Sets the fields of the pagination object that control database query and paging
 * 
 *    @param {object} query - query parameters from url
 *    @param {paging} paging contains pertinent control attributes for pagination
 *    @return callback function
 */ 
function getSearchAndOrder(query, paging, callback) {

  if (query.offset) {
    paging.offset = query.offset;
  }
  if (query.order) {
      paging.order = query.order;
  }

  /** Check if search parameter came in on query.
     * If so, turn off search parameters
     */
  if (query.search) {
    if (query.search === 'off') {
      paging.title = '%';
      paging.author = '%';
      paging.genre = '%';
    }
  // If there is a query search string,
  // find what column to search on 
  } else if (query.searchStr) {
    if (query.searchOn === 'title') {
      paging.title = query.searchStr + '%';
    } else if (query.searchOn === 'author') {
      paging.author = query.searchStr + '%';
    } else if (query.searchOn === 'genre') {
      paging.genre = query.searchStr + '%';
    }
  } 
    callback();
}

/** 
 * FUNCTION getSubtitle
 *    Contructs a subtitle to indicate active search parameters
 * 
 *    @param {object} query - query parameters from url
 *    @return callback function
 */ 
function getSubtitle(query, callback) {
  if (query.searchStr) {
    if (subtitle !== '') {
      subtitle = subtitle + ' AND ' + query.searchOn + ' begins with ' + query.searchStr;
    } else if (subtitle === '') {
        subtitle = 'WHERE ' + query.searchOn + ' begins with ' + query.searchStr;
    } 
  } else if (query.search) {
    subtitle = '';
  }
  callback();
}

module.exports = router;
