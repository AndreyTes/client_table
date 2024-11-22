const express = require("express");
const app = express();
const axios = require("axios");
const { google } = require("googleapis");
const { get, post } = axios;
const readline = require("readline");
const fs = require("fs");

const PORT = 3000;
const API_BASE_URL = "http://94.103.91.4:5000";
const TOKEN_PATH = "token.json"
const CREDENTIALS_PATH = "client_secret.json"

let oAuth2Client;

app.get("/write-table", (req, res) => {
  async function authorizeGoogleSheets() {
    try {
      const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
      const { client_id, client_secret, redirect_uris } = credentials.installed;
      oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
      );

      if (fs.existsSync(TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
        oAuth2Client.setCredentials(token);
        return oAuth2Client;
      }

      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      console.log("Перейдите по следующей ссылке для авторизации:", authUrl);

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      return new Promise((resolve, reject) => {
        rl.question("Введите код из браузера: ", async (code) => {
          rl.close();
          try {
            const { tokens } = await oAuth2Client.getToken(code);
            oAuth2Client.setCredentials(tokens);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
            console.log("Токен сохранен в:", TOKEN_PATH);
            resolve(oAuth2Client);
          } catch (error) {
            console.error("Ошибка получения токена:", error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error("Ошибка авторизации:", error);
      throw error;
    }
  }

  async function registration() {
    try {
      const response = await post(`${API_BASE_URL}/auth/registration`, {
        username: "test_user000000000000000",
      });
      const { token } = response.data;
      return token;
    } catch (error) {
      console.error(
        "Ошибка получения токена:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  async function getTokenByLogin() {
    try {
      const response = await post(`${API_BASE_URL}/auth/login`, {
        username: "test_user000000000000000",
      });
      const { token } = response.data;
      console.log("token", token);
      return token;
    } catch (error) {
      console.error(
        "Ошибка получения токена:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  async function getClientsData(token) {
    try {
      const responseCliens = await get(`${API_BASE_URL}/clients`, {
        headers: { Authorization: `${token}` },
      });
      const userIds = responseCliens.data.map((item) => item.id);

      const responseStatuses = await post(
        `${API_BASE_URL}/clients`,
        { userIds },
        {
          headers: { Authorization: `${token}` },
        }
      );

      const clientsWithStatuses = responseCliens.data.map((client) => {
        const clientStatus = responseStatuses.data.find(
          (status) => status.id === client.id
        );
        return {
          ...client,
          status: clientStatus ? clientStatus.status : "Unknown",
        };
      });

      return clientsWithStatuses;
    } catch (error) {
      console.error(
        "Ошибка получения данных клиентов:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  async function writeToGoogleSheet(data, auth) {
    try {
      const sheets = google.sheets({ version: "v4", auth });

      const rows = data.map((client) => [
        client.id,
        client.firstName,
        client.lastName,
        client.gender,
        client.address,
        client.city,
        client.phone,
        client.email,
        client.status,
      ]);

      await sheets.spreadsheets.values.update({
        spreadsheetId: "13vViFeybltd9Ustx2l39B3Lj2SL0r1MDLI6h53uXsQI",
        range: "Sheet1!A1",
        valueInputOption: "RAW",
        resource: {
          values: [
            [
              "ID",
              "First Name",
              "Last Name",
              "Gender",
              "Address",
              "City",
              "Phone",
              "Email",
              "Status",
            ],
            ...rows,
          ],
        },
      });
      console.log("Данные успешно записаны в Google Таблицу!");
    } catch (error) {
      console.error("Ошибка записи в Google Таблицу:", error.message);
      throw error;
    }
  }

  (async () => {
    try {
      await authorizeGoogleSheets();
      await registration();
      const token = await getTokenByLogin();
      const clientsData = await getClientsData(token);
      await writeToGoogleSheet(clientsData, oAuth2Client);
    } catch (error) {
      console.error("Ошибка выполнения программы:", error.message);
    }
  })();
  res.send("Данные успешно записаны в Google Таблицу!");
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
