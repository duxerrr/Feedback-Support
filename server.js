// tämä esimerkki käyttää require-tyyliä tuontiin - myös import toimii
const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");

// käytetään mysql2-kirjaston lupauksiin perustuvia funktioita
// muuten lupaukset pitäisi koodata itse - tietokantaoperaatioita on pakko odottaa
const mysql = require("mysql2/promise");

// tuodaan tietokannan asetukset muuttujaan
const dbconfig = require("./dbconfig.json");
const { log } = require("console");

const app = express();
const PORT = 3000;

// luodaan yhteysnippu ENNEN palvelimen reittejä
// tämä ei vaadi odottamista (await), sillä se on synkroninen ja vain alustaa tarvittavat muuttujat, ei vielä käytä tietokantaa (yhteys luodaan, kun sitä pyydetään ensimmäisen kerran)

app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to `true` if using HTTPS
  })
);

const pool = mysql.createPool(dbconfig);

app.set("view engine", "ejs");

const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/");
  }
  next();
};

app.get("/", async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();

    res.render("login", { message: "" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

app.get("/logout", requireLogin, (req, res) => {
  req.session.destroy((err) => {
    if (err) throw err;
    // Huomaa redirect eli ohjaaminen etusivulle! Ei siis render!
    res.redirect("/");
  });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  let connection;

  try {
    connection = await pool.getConnection();

    let [rows] = await connection.execute(
      "SELECT * from system_user WHERE id = ?",
      [username]
    );

    if (rows.length === 0) {
      [rows] = await connection.execute(
        "SELECT * from system_user WHERE email = ?",
        [username]
      );
    }

    if (rows.length === 0) {
      return res.render("login", { message: "Wrong username or password." });
    }

    if (rows[0].admin == 0) {
      return res.render("login", { message: "Wrong username or password." });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render("login", {
        message: "Wrong username or password.",
      });
    }

    req.session.user = { id: user.id, username: user.fullname };

    res.redirect(`/asiakkaat`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

app.get("/asiakkaat", requireLogin, async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [rows] = await connection.execute("SELECT * from system_user");
    const [asiakas] = await connection.execute("SELECT * from customer");

    const company = [];
    const IDs = [];
    const fullnames = [];
    const email = [];
    const admin = [];

    for (let i = 0; i < rows.length; i++) {
      let add = "";

      if (rows[i].customer_id == 1) {
        add = asiakas[0].name;
      } else if (rows[i].customer_id == 2) {
        add = asiakas[1].name;
      } else if (rows[i].customer_id == 3) {
        add = asiakas[2].name;
      } else if (rows[i].customer_id == 4) {
        add = asiakas[3].name;
      } else if (rows[i].customer_id == 5) {
        add = asiakas[4].name;
      } else {
        add = "";
      }
      company.push(add);
    }
    for (let i = 0; i < rows.length; i++) {
      IDs.push(rows[i].id);
    }
    for (let i = 0; i < rows.length; i++) {
      fullnames.push(rows[i].fullname);
    }
    for (let i = 0; i < rows.length; i++) {
      email.push(rows[i].email);
    }
    for (let i = 0; i < rows.length; i++) {
      let add = "";
      if (rows[i].admin == 1) {
        add = "Kyllä";
      } else {
        add = "Ei";
      }
      admin.push(add);
    }

    res.render("kayttajat", {
      company: company,
      IDs: IDs,
      fullnames: fullnames,
      email: email,
      admin: admin,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

app.get("/tuki", requireLogin, async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [rows] = await connection.execute("SELECT * from system_user");
    const [support] = await connection.execute("SELECT * from support_ticket");
    const [check_company] = await connection.execute("SELECT * from customer");
    const [check_status] = await connection.execute(
      "SELECT * from ticket_status"
    );

    const status = [];
    const IDs = [];
    const saapunnut = [];
    const company = [];
    const kuvaus = [];
    const kasitelty = [];

    for (let i = 0; i < support.length; i++) {
      let add = "";

      if (support[i].status == 1) {
        add = check_status[0].description;
      } else if (support[i].status == 2) {
        add = check_status[1].description;
      } else if (support[i].status == 3) {
        add = check_status[2].description;
      } else if (support[i].status == 4) {
        add = check_status[3].description;
      } else {
        add = "";
      }
      status.push(add);
    }

    for (let i = 0; i < support.length; i++) {
      IDs.push(support[i].id);
    }

    for (let i = 0; i < support.length; i++) {
      saapunnut.push(support[i].arrived);
    }

    for (let i = 0; i < support.length; i++) {
      let add = "";

      if (support[i].customer_id == 1) {
        add = check_company[0].name;
      } else if (support[i].customer_id == 2) {
        add = check_company[1].name;
      } else if (support[i].customer_id == 3) {
        add = check_company[2].name;
      } else if (support[i].customer_id == 4) {
        add = check_company[3].name;
      } else if (support[i].customer_id == 5) {
        add = check_company[4].name;
      } else {
        add = "";
      }
      company.push(add);
    }

    for (let i = 0; i < support.length; i++) {
      kuvaus.push(support[i].description);
    }

    for (let i = 0; i < support.length; i++) {
      let getFix = support[i].handled;

      if (getFix == null) {
        kasitelty.push(null);
      } else {
        let date = new Date(getFix);
        let Fix = date.toISOString().slice(0, 19).replace("T", " ");

        kasitelty.push(Fix);
      }
    }

    const saapunnutFix = saapunnut.map((dateStr) => {
      if (dateStr == null) {
        return;
      } else {
        let date = new Date(dateStr);
        return date.toISOString().slice(0, 19).replace("T", " ");
      }
    });

    res.render("tuki", {
      status: status,
      IDs: IDs,
      saapunnutFix: saapunnutFix,
      company: company,
      kuvaus: kuvaus,
      kasitelty: kasitelty,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

app.get("/palaute", requireLogin, async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [rows] = await connection.execute("SELECT * from system_user");
    const [getfeedback] = await connection.execute("SELECT * from feedback");

    const no_info_customer = [];
    const saapunnut = [];
    const vieraan_nimi = [];
    const vieraan_email = [];
    const palaute = [];
    const kasitelty = [];

    for (let i = 0; i < getfeedback.length; i++) {
      let add = "";

      if (getfeedback[i].guest_name == null) {
        let unknow = getfeedback[i].from_user;

        for (let a = 0; a < rows.length; a++) {
          if (unknow == a) {
            a--;
            add = rows[a].fullname;
            no_info_customer.push(add);
            break;
          } else {
          }
        }
      } else {
        no_info_customer.push(add);
      }
    }

    for (let i = 0; i < getfeedback.length; i++) {
      saapunnut.push(getfeedback[i].arrived);
    }

    for (let i = 0; i < getfeedback.length; i++) {
      vieraan_nimi.push(getfeedback[i].guest_name);
    }

    for (let i = 0; i < getfeedback.length; i++) {
      vieraan_email.push(getfeedback[i].guest_email);
    }

    for (let i = 0; i < getfeedback.length; i++) {
      palaute.push(getfeedback[i].feedback);
    }

    for (let i = 0; i < getfeedback.length; i++) {
      kasitelty.push(getfeedback[i].handled);
    }

    const saapunnutFix = saapunnut.map((dateStr) => {
      let date = new Date(dateStr);
      return date.toISOString().slice(0, 19).replace("T", " ");
    });

    const kasiteltyFix = kasitelty.map((dateStr) => {
      if (dateStr == null) {
        return;
      } else {
        let date = new Date(dateStr);
        return date.toISOString().slice(0, 19).replace("T", " ");
      }
    });

    res.render("palaute", {
      no_info_customer: no_info_customer,
      saapunnutFix: saapunnutFix,
      vieraan_nimi: vieraan_nimi,
      vieraan_email: vieraan_email,
      palaute: palaute,
      kasiteltyFix: kasiteltyFix,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

app.get("/tuki/:id", requireLogin, async (req, res) => {
  const idFind = req.params.id;

  let connection;

  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute("SELECT * from system_user");
    const [company] = await connection.execute("SELECT * from customer");
    const [supportM] = await connection.execute(
      "SELECT * from support_message"
    );
    const [supportT] = await connection.execute("SELECT * from support_ticket");
    const [status] = await connection.execute("SELECT * from ticket_status");

    const ticketFind = [];
    const getTicket = [];
    const from = [];
    const vastaus = [];
    let kuvaus = [];
    let getstatus = "";
    let from_company = "";

    const [ticketExists] = await connection.execute(
      "SELECT id FROM support_message WHERE id = ?",
      [idFind]
    );

    if (ticketExists.length === 0) {
      return res.redirect("/tuki");
    }

    for (let i = 0; i < supportM.length; i++) {
      let add = "";
      if (idFind == supportM[i].ticket_id) {
        add = supportM[i];
        ticketFind.push(add);
      } else {
      }
    }

    //Status
    for (let i = 0; i < supportT.length; i++) {
      if (idFind == supportT[i].id) {
        getTicket.push(supportT[i]);
      }
    }

    for (let i = 0; i < getTicket.length; i++) {
      if (getTicket[i].status == 1) {
        getstatus = status[0].description;
      } else if (getTicket[i].status == 2) {
        getstatus = status[1].description;
      } else if (getTicket[i].status == 3) {
        getstatus = status[2].description;
      } else if (getTicket[i].status == 4) {
        getstatus = status[3].description;
      } else if (getTicket[i].status == 5) {
        getstatus = status[4].description;
      } else {
        getstatus = "-";
      }
    }

    for (let i = 0; i < ticketFind.length; i++) {
      for (let a = 0; a < rows.length; a++) {
        if (ticketFind[i].from_user == rows[a].id) {
          from.push(rows[a]);
        }
      }
    }

    for (let i = 0; i < company.length; i++) {
      if (from[0].customer_id == company[i].id) {
        from_company = company[i].name;
      }
    }

    let ticket_handledFix = "";
    let create_ticketFix = "";
    let create_time_find = idFind - 1;

    if (supportT[create_time_find].arrived == null) {
      create_ticketFix = "--";
    } else {
      let date = new Date(supportT[create_time_find].arrived);
      create_ticketFix = date.toISOString().split("T").join(" ").slice(0, 19);
    }

    if (supportT[create_time_find].handled == null) {
      ticket_handledFix = "--";
    } else {
      let date = new Date(supportT[create_time_find].handled);
      ticket_handledFix = date.toISOString().split("T").join(" ").slice(0, 19);
    }

    for (let i = 0; i < ticketFind.length; i++) {
      let getFix = ticketFind[i].created_at;
      let date = new Date(getFix);
      let Fix = date.toISOString().slice(0, 19).replace("T", " ");

      vastaus.push(Fix);
    }

    let kuvaus_num = idFind - 1;
    kuvaus = supportT[kuvaus_num].description;

    res.render("viewtuki", {
      idFind: idFind,
      ticketFind: ticketFind,
      getstatus: getstatus,
      from: from,
      from_company: from_company,
      create_ticketFix: create_ticketFix,
      ticket_handledFix: ticket_handledFix,
      vastaus: vastaus,
      kuvaus: kuvaus,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

app.post("/ChangeStatus", requireLogin, async (req, res) => {
  const id = req.body.pageId;
  const changeStatus = req.body.StatusChange;
  let date = null;
  if (changeStatus == 4) {
    date = new Date();
  }

  let connection;

  try {
    connection = await pool.getConnection();
    await connection.execute(
      "UPDATE support_ticket SET handled = ?, status = ? WHERE id = ?",
      [date, changeStatus, id]
    );
    res.redirect(`tuki/${id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

app.post("/SendMessage", requireLogin, async (req, res) => {
  const text = req.body.textInput;
  const id = req.body.pageId;
  const date = new Date();
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.execute(
      "INSERT INTO support_message (created_at, ticket_id, reply_to, from_user, body) VALUES (?,?, null, ?, ?)",
      [date, id, req.session.user.id, text]
    );

    res.redirect(`tuki/${id}`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  } finally {
    if (connection) {
      await connection.release();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
