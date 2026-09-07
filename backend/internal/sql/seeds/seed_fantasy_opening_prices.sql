-- Showtime Fantasy — opening player prices
-- Every player on the current roster (693), so nobody is left unpriced in the
-- transfer market. 231 come from the workbook
-- (Showtime_Fantasy_Player_Pricing_Model.xlsx) matched to a real player id by
-- exact name; the other 462 — no confident match, a
-- wrong guess would risk pricing the wrong person — sit at the 3.0m floor
-- and can be corrected individually once their workbook identity is confirmed
-- (see unmatched_players_for_review.md).
--
-- No joins, no lookups: every id below is a literal players.id row.
--
--   psql "$DB_URL" -f seed_fantasy_opening_prices.sql

INSERT INTO fantasy_player_prices (season_id, player_id, gameweek_id, base_price, price)
SELECT '22a076a8-91d1-4189-921e-12d1b89acccb'::uuid, v.player_id::uuid, NULL, v.price, v.price
FROM (VALUES
    ('ccb79bc4-2f2b-4771-b5c5-99bed66fe91f',   3.0),  -- ABIODUN ENITAN DAVID — no workbook match, floor
    ('de16c913-18c8-45d7-8dcf-ce8835cbe8cf',   3.0),  -- ADAEZE INNOCENT PRECIOUS — no workbook match, floor
    ('eb57c71a-3b60-47ae-a2a6-bcac90cf1a16',   3.0),  -- ARENAH — no workbook match, floor
    ('e7a4c78c-9fcb-4330-884e-224544b07435',   3.0),  -- Aaron Amadasun — no workbook match, floor
    ('605d7e5f-63d1-46b3-9a44-fdfad6326b22',  11.5),  -- Abayomi Agbayewa — Abayomi Agbayewa (IKN)
    ('535ee84a-7e64-46e7-8d23-2ba85d0e7db4',   3.0),  -- Abbey Cole — no workbook match, floor
    ('9700733c-098a-4e73-8410-dd38a1bc5c28',   3.0),  -- Abdulakeem Somad — no workbook match, floor
    ('e871b747-52f5-44f0-a492-1367daf1b859',   6.5),  -- Abdulateef Sheu — Abdulateef Sheu (RAP)
    ('b9e865a0-78d4-4322-96cd-39c128e467b3',   3.0),  -- Abdulganiyu Sulaimon olatunde — no workbook match, floor
    ('fb187a1f-9507-4885-a742-f3b46ca1b885',  12.0),  -- Abiodun Akintoye — Abiodun Akintoye (RAP)
    ('afa82e00-cac4-49f7-96c7-acf9cb5b99c2',   3.0),  -- Abiola Kasumu — no workbook match, floor
    ('d4741ade-d143-4abc-bd3e-a99e0d3a4849',   3.0),  -- Abudu Fathia — Abudu Fathia (ALP)
    ('47b698cc-7c91-4799-af3f-3de8b4c60a83',   3.0),  -- Ada Victoria — no workbook match, floor
    ('63b0c160-f455-47ed-a3a7-c0abe1310541',   3.0),  -- Adaeze Jonathan — no workbook match, floor
    ('944ea8ce-daa6-40ab-b991-c90cca60cdc0',   3.0),  -- Adams Obodumu — no workbook match, floor
    ('2524c2ee-2fe4-4adc-bff5-846466651f22',   3.0),  -- Adaobi Nweze — no workbook match, floor
    ('e3d3fb07-7d44-47d9-91d0-3475609f93d2',   3.0),  -- Adaora Lisa Edward — no workbook match, floor
    ('2c5d7189-d06c-4fca-9dbc-40cfeb2534f6',   3.0),  -- Adebare Adejumo — no workbook match, floor
    ('b1350edb-54f8-4cb1-b72d-a2ead340687c',   3.0),  -- Adebayo Oluwatobi — no workbook match, floor
    ('4cbcd3b9-b7d7-41c2-aa1c-28e09e2dd1ed',   3.0),  -- Adebola Ogundogba — no workbook match, floor
    ('b177c78a-1a35-4fcb-96bc-d73d36a3f257',   3.0),  -- Adebola Taiwo — Adebola Taiwo (ALP)
    ('d8382394-d442-435d-ace9-2b032a023aed',   9.5),  -- Adebowale Osipitan — Adebowale Osipitan (GBK)
    ('49f868ea-ba31-4bc5-9fa3-65979fcd5f62',   3.0),  -- Adefisayo Salako — no workbook match, floor
    ('54a21fb8-36cc-40a4-b80c-944778b0b3e3',   7.0),  -- Adejoke Talabi — Adejoke Talabi (HNS)
    ('b4862022-06d9-4714-8a5a-81b547c2d6a0',   3.0),  -- Adekanmbi Ridwan — no workbook match, floor
    ('9318e724-280e-464a-9b29-c819a8c04725',   4.5),  -- Adekunle Waliya — Adekunle Waliya (HNS)
    ('b3bc4d71-9e96-4cf2-bc86-fa4c1f5a5cb5',   3.0),  -- Adele 32 — no workbook match, floor
    ('e085a09d-5603-4f85-ac7a-7bfd831f8536',   3.0),  -- Adeniyi Ileri — Adeniyi Ileri (WAR)
    ('cce08765-8bb9-498b-bf4b-2d3c8838dfa0',   6.0),  -- Adeoye Anuoluwapo — Adeoye Anuoluwapo (ALP)
    ('1c1378c0-5061-4042-88e3-e2991a01482a',   3.0),  -- Adeoye Ayomide Copeland — no workbook match, floor
    ('5f23131f-484e-4ed9-b02c-894d60a9b99d',   3.0),  -- Adeoye Ayomide Copeland — no workbook match, floor
    ('941e6f33-adf8-49a3-89a2-992e441bb4ed',   3.0),  -- Adeoye Copeland Ayomide — Adeoye Copeland Ayomide (BRV)
    ('37f9f799-5368-4978-b7f7-5f1926481ead',   7.0),  -- Adetutu Oshikoya — Adetutu Oshikoya (WAR)
    ('38874a20-6f4c-45c4-8288-79770e205370',   3.0),  -- Adewale Mosimiloluwa — no workbook match, floor
    ('68ba483c-717b-4191-9178-5c0cd7ffe8e6',   3.0),  -- Adewole Adeola Adetoye — no workbook match, floor
    ('e932754d-73a4-4e6b-8ede-ec6336ef2fc1',   6.0),  -- Adewole Mosimiloluwa — Adewole Mosimiloluwa (HNS)
    ('fe5689d5-fcba-4f22-942c-d50275be1eba',   3.0),  -- Adoyi Emmanuel — no workbook match, floor
    ('312dc451-78e6-40ea-8f70-8991b53e2b36',   3.0),  -- Afeye Momoh — no workbook match, floor
    ('085e89ba-e20b-4d76-8b95-a55610559151',   7.5),  -- Afeye momoh — Afeye momoh (LAK)
    ('dd0d7fb2-00ff-42a7-9538-cf19ea5ba6d7',   5.0),  -- Afolabi Ogunnaike — Afolabi Ogunnaike (ALP)
    ('3bf92a89-8f09-4d52-a2c5-f84f74756544',   3.0),  -- Agatha Sanubi — no workbook match, floor
    ('5dae545a-7aef-458a-b8e8-b379886bc994',   3.0),  -- Agbokeye Mayowa — no workbook match, floor
    ('e9989a33-b345-4d9e-874c-d14c31204091',   9.5),  -- Aghahowa Damian — Aghahowa Damian (GBK)
    ('6dcb186d-6e30-4c2c-ba87-4bd482f7b025',   3.0),  -- Agu Stanley Chiedozie — no workbook match, floor
    ('115ae3a5-8273-406f-93b4-1d5294cf73c9',   3.0),  -- Ahmed Olusoji — no workbook match, floor
    ('4420212c-8cc9-4579-8476-472447053dfe',   3.0),  -- Aisha Raji — no workbook match, floor
    ('595a2b81-6c8b-4baa-a516-feda5d76bc58',   4.5),  -- Aisha Raji Oluwatosin — Aisha Raji Oluwatosin (RAP)
    ('1ec41fa0-5ed7-468b-89fb-cd6476344dac',   3.0),  -- Aishat Garuba — no workbook match, floor
    ('250e393f-405c-4fd8-92a7-dd17530504af',   3.0),  -- Akide Boluwatife — no workbook match, floor
    ('15906137-dec0-45bf-b46f-043c991d99fd',   8.0),  -- Akinade Rukayat — Akinade Rukayat (REB)
    ('43acb9b1-a0f2-4533-85f5-36f93b796df0',   3.0),  -- Akinbule Jennifer — no workbook match, floor
    ('6ba3b0f3-d36e-4ce5-828d-0d157fbbaad9',   4.0),  -- Akinlade Gideon — Akinlade Gideon (PAN)
    ('002f5db3-9bed-4ed8-a6f4-bd0f17a9030d',   3.0),  -- Akinpelu Timilehin — no workbook match, floor
    ('0d30bea4-9f64-4c2d-adfa-3d6d47b33301',   3.0),  -- Akinrinmade Mofeoluwa — no workbook match, floor
    ('91c82fbd-3461-4157-8b5f-b17eb784e440',   3.0),  -- Akinwale 74 — no workbook match, floor
    ('31b28b8b-c2ff-4324-8933-cedd09ad4697',   3.0),  -- Akitoye Ogboye — no workbook match, floor
    ('64170fcf-6c92-4fbf-9320-7183907aada2',   3.0),  -- Akorede Azeezat — no workbook match, floor
    ('d4a21a95-e917-44e3-988b-4d4d99caa979',   3.0),  -- Aladeyelu Blessing — no workbook match, floor
    ('0dd68d7b-1617-4e11-aa87-19e9d1af55ee',   3.0),  -- Alexandra Ugwu — no workbook match, floor
    ('751f468a-eace-4e43-a492-5d20b56f332a',   6.0),  -- Ali Abubakar — Ali Abubakar (LAK)
    ('b2143bfb-bbde-4db5-9d1a-84846071f5ad',   3.0),  -- Aliandu Lia — no workbook match, floor
    ('d65afa82-2e9f-4a24-aa1d-5db191485b23',   3.0),  -- Aliandu Priscillia — no workbook match, floor
    ('aff33d82-944d-4d5b-b4e0-e8d78119003b',   3.5),  -- Alicho Christian — Alicho Christian (GBK)
    ('4bb9e237-1b72-4f3e-8dfa-44f2afa5037e',   3.0),  -- Allison Opemipo — no workbook match, floor
    ('2741d5e1-3e4e-40d0-a185-bb9ca59b5277',   3.0),  -- Ama 22 — no workbook match, floor
    ('31dd0d86-037a-400c-94c5-8e2f1d6818a1',   3.0),  -- Ama Hogan — no workbook match, floor
    ('42804ba4-db7d-4b61-b6ad-bbd019d53ad5',   7.5),  -- Ambrose victor Chibueze — Ambrose victor Chibueze (RAP)
    ('d507e811-2c59-4c09-8528-47639a81d2d9',   4.0),  -- Ameerah Omotosho — Ameerah Omotosho (BRV)
    ('e5a37550-295b-43f6-89ab-d0b792798299',   3.0),  -- Amina Amusa — no workbook match, floor
    ('8776772b-cc06-4e62-b82a-05c54c79c7b7',   3.0),  -- Amodu Taiwo — Amodu Taiwo (HNS)
    ('ff9b523c-bee7-4897-8af7-b4b2e80fab49',   3.0),  -- Amos Adegboyega — no workbook match, floor
    ('c993213a-c1ff-467f-b506-87ac87b581e9',   4.0),  -- Amos Samuel — Amos Samuel (IKN)
    ('1934d5ef-943a-4642-9d6b-1b164b583bd7',   3.0),  -- Angel Igbafe — no workbook match, floor
    ('ec262ac0-0a9e-4f85-8c0e-92717c1442ef',   3.0),  -- Angel Ukiaghe Igbafe — no workbook match, floor
    ('c580d981-2c92-4751-918d-9abd115d6dfd',   3.0),  -- Anireju Ayida — no workbook match, floor
    ('336406d1-70bd-4a69-acad-4e0eea9cb7b1',   3.0),  -- Anointing Nevo — no workbook match, floor
    ('0350874e-4521-4b37-a5b7-7256819bd8d1',   3.0),  -- Anozie Uchechukwu — no workbook match, floor
    ('597cfb6e-0f53-41f8-acc7-27d05f7e6f00',   3.0),  -- Anthonia Abaja — no workbook match, floor
    ('d4c30d76-39ab-4bd1-a832-c84e3204e15f',   3.0),  -- Anthony Sugar — no workbook match, floor
    ('b2af2eb6-b062-45b6-b325-e9e0e73ed30f',   3.0),  -- Anuoluwapo Oyebanji — no workbook match, floor
    ('d690c4d9-89e8-469e-bcce-e24db3636b80',   3.0),  -- Anurunkem Favour — no workbook match, floor
    ('4202dc68-eba6-479d-8507-a2e1a31b2309',  11.5),  -- Anyaorah Lotanna — Anyaorah Lotanna (LAK)
    ('3aa3829f-42a9-4409-a48d-7b8be2350b55',   3.0),  -- Anyaorah Lotanna — no workbook match, floor
    ('4ef9aa49-3f14-4a3c-8a35-243270565717',   3.0),  -- Arigbabuwo Basirat Anuoluwapo — Arigbabuwo Basirat Anuoluwapo (GBK)
    ('c31f48db-2e3c-4d47-b51e-b78cbc8c0ec3',   3.0),  -- Aseobong Larry-Ettah — no workbook match, floor
    ('c8dfc8aa-6939-4034-a51c-72a21fd16ced',   3.0),  -- Ashagbesoro Kafayat — no workbook match, floor
    ('e936e34a-495a-4d08-8de2-df7fd298c6a7',   3.0),  -- Ates Brown — Ates Brown (WAR)
    ('14c4ebc8-4900-4679-aa1c-ce1f290e3a12',  10.0),  -- Awele Okoh — Awele Okoh (LAK)
    ('aa6e864f-197a-4a93-b774-9ab16136702f',   6.0),  -- Awosika Oluwafikunmi — Awosika Oluwafikunmi (HNS)
    ('11bdd466-3a4b-4718-8561-21a82b596e53',   3.0),  -- Ayelagba Moses — no workbook match, floor
    ('70b2e61b-776b-4361-ba54-42d70f4fba6a',   8.5),  -- Ayinde Faruq M. — Ayinde Faruq M. (BRV)
    ('f1376648-1355-4b24-a44a-28e6fc50533b',   3.0),  -- Ayinde Sodiq — no workbook match, floor
    ('4f3caa0d-8a9f-475e-b0f1-0a2c0aabb48b',   3.0),  -- Ayinde Sodiq — no workbook match, floor
    ('b75b7c8e-8e64-417b-a0ea-ef410ff1e13f',   3.0),  -- Ayisat A — no workbook match, floor
    ('83966f22-7eea-4aff-ab8a-3d5b2f6a9e72',   3.0),  -- Ayobami Odedina — no workbook match, floor
    ('bcd09b09-6625-4b5e-b407-730644ec4830',   8.0),  -- Ayodeji Olarewaju — Ayodeji Olarewaju (GBK)
    ('0ad3c639-846a-4719-ae6c-bbe51cdeaee8',   3.0),  -- Ayogu Aero divine ebube — no workbook match, floor
    ('9a540cb2-1951-4158-9144-1c8da7bdb47b',   5.5),  -- Ayomide Adeniji — Ayomide Adeniji (GBK)
    ('7a0c55c0-aa59-4548-a44f-67716b096e56',   3.0),  -- Ayomide Copeland Adeoye — no workbook match, floor
    ('e44f83b9-1b9b-4bfc-a88a-92cc8701a7ac',   3.0),  -- Ayomikun Beremoye — no workbook match, floor
    ('77ac4041-621e-458c-b760-f962f7358e93',   3.0),  -- Azeez Ololade — no workbook match, floor
    ('13c0baa1-8362-4b6e-963d-54d0dd755053',   3.0),  -- Babajide Songonuga — no workbook match, floor
    ('6f8d74d3-87d9-4ca8-88e6-7bebcada00d9',   3.0),  -- Babalola Surprise — no workbook match, floor
    ('f44789ac-22ef-41b4-b2b3-7fcd04c86adb',   3.0),  -- Babatunde Adeola — no workbook match, floor
    ('9b81ea2d-a55b-49a1-90bc-230deb4065b6',   3.0),  -- Babatunde Mustapha — no workbook match, floor
    ('67eeafcb-adc5-4776-92d4-4ad2c8474c4d',   3.0),  -- Babatunde Taiwo — no workbook match, floor
    ('cad50103-a30e-49f4-85c2-743ea658df22',   3.0),  -- Badmus Fatima — no workbook match, floor
    ('945ca1f3-d630-47c1-ba77-36bb6bfd228a',   3.0),  -- Badmus Gbolahan — no workbook match, floor
    ('d47714f6-bff8-4514-aead-37627f0028a8',   3.0),  -- Badmus Taiwo — no workbook match, floor
    ('9752c15a-e130-4066-b5a5-a7fd9c8dc51f',   3.5),  -- Bakare Oyinlola — Bakare Oyinlola (HNS)
    ('d579e32a-43a2-4140-bfe7-5203b08cfda4',   3.0),  -- Bala Lawal — no workbook match, floor
    ('c948cb12-388d-492c-809f-85ac0639f35b',   6.5),  -- Balikis Bello — Balikis Bello (LAK)
    ('c0e12339-13b4-4c88-aa81-7185c534bc5b',   3.0),  -- Balogun Faisat Olajumoke — no workbook match, floor
    ('328fefe6-66bf-4b03-b2a7-910786199c2f',   3.0),  -- Balogun Fathia — no workbook match, floor
    ('6eb508d2-02a0-4104-8791-a12a234e0ecb',   3.0),  -- Bamidele Naomi — no workbook match, floor
    ('b7dd25c1-328d-4826-9c39-1e688c3cdbdb',   3.0),  -- Bamidele Wasiu — no workbook match, floor
    ('492051dd-f4a8-4036-a441-f56ff3a85e9f',   3.0),  -- Basit 87 — no workbook match, floor
    ('469e70bb-94dc-45e7-ae0a-09d2a076624d',  10.0),  -- Basit Muritala — Basit Muritala (PAN)
    ('3bb44a6b-a264-4184-bde5-dae670a3ab8d',   3.0),  -- Beatrice ohobu — no workbook match, floor
    ('155fbfea-7188-4da1-9a2e-a14563eef8e1',  10.0),  -- Bello Anuoluwapo — Bello Anuoluwapo (WAR)
    ('393acc28-9cd2-4443-bf5d-5b9755b6745b',   3.0),  -- Bello Balikis — no workbook match, floor
    ('16ddc54c-8eb3-401a-9a56-4a3fd2774992',  12.5),  -- Bello Remilekun — Bello Remilekun (WAR)
    ('1101a03b-48d6-4946-a5ee-799edf86a63a',   3.0),  -- Bertyes Bright Yerie — no workbook match, floor
    ('793a72e2-cf7a-46a3-adf4-7de9757ce8ce',   3.0),  -- Bessan Gbenga Korede — no workbook match, floor
    ('f4fdf0f8-93bb-4fc5-b513-4ba5fd58d4fa',   3.0),  -- Blessing Chijioke — no workbook match, floor
    ('fe8b4967-870f-4375-95c9-4c378551ea46',   3.0),  -- Bodunrin Sasore — no workbook match, floor
    ('7453cbec-2f5d-4afb-b321-4385b3116f83',   8.0),  -- Bolaji Idris — Bolaji Idris (IKN)
    ('36b2c50c-d3d1-4231-8b37-e71f64d991a2',   4.5),  -- Bolu Kujore-Onifade — Bolu Kujore-Onifade (IKN)
    ('d6c79640-f243-4a78-a161-023232100f85',  12.0),  -- Boluwatife Akinde — Boluwatife Akinde (BRV)
    ('4048b7bd-89e5-45d3-97a8-c5ef072d6022',   4.0),  -- Bowofoluwa Oyerinde — Bowofoluwa Oyerinde (LAK)
    ('a623f198-bbe9-4943-b7b6-9ada248dee28',   3.0),  -- Bowofoluwa Oyerinde — no workbook match, floor
    ('589afc62-b47a-4821-950d-56e603b2a0e4',   3.0),  -- Braden Cline — no workbook match, floor
    ('cd63a186-6a63-4e8d-a3c9-8c0a9f29b994',   5.0),  -- Bright Yerie Bertyes — Bright Yerie Bertyes (HNS)
    ('cffb3acb-b433-47a9-82d1-af6574bd8bb8',   3.0),  -- Buchi Okoro — no workbook match, floor
    ('2812453d-d127-411d-8003-8b981f8fb79d',   3.0),  -- Bukem Praise — no workbook match, floor
    ('1e78560e-c170-41ba-b697-600e978e5f7a',   4.5),  -- Busayo Agubiade — Busayo Agubiade (HNS)
    ('f299a5fe-d4b9-422b-9911-2cf4cded4180',   5.0),  -- Charles Franklin — Charles Franklin (HNS)
    ('4fae89a6-176e-4635-8a5c-5bd360a8f93f',   3.0),  -- Charles favour Queen — no workbook match, floor
    ('3d592236-ac04-4941-ae3d-bb8e418edae1',   3.0),  -- Chelsea Onuorah — no workbook match, floor
    ('3f54379a-af06-484d-8004-46e3a18b046b',   3.0),  -- Chetanna Egbuna — no workbook match, floor
    ('cb834165-290c-4ca4-9b58-57e0a0509dfa',   3.0),  -- Chibuike Ebube Annastatia — no workbook match, floor
    ('6a23ad18-4e34-43ca-8cfb-3d304cdfe4b5',   8.5),  -- Chibuzor Daniel Onyegu — Chibuzor Daniel Onyegu (GBK)
    ('b649efe1-6372-4709-9f83-6a1353ca45ad',   4.5),  -- Chidi Ugoji — Chidi Ugoji (REB)
    ('81b68169-d70d-416e-b8ef-cb64624fbb7f',   4.5),  -- Chidinma Onyenezi — Chidinma Onyenezi (REB)
    ('57f9ca73-8a60-4a37-b0da-13ff15d8c292',   3.0),  -- Chidinma Uzoma — no workbook match, floor
    ('c7c586e0-63c5-48aa-af5d-bca795fb02e4',   3.0),  -- Chike Okala — Chike Okala (IKN)
    ('f1ae7203-0ab0-49b2-b944-ba95823878b6',   3.0),  -- Chima Ohajianya — no workbook match, floor
    ('bb4a3c3a-8c98-4b33-ac88-8ddf6f6ddf6a',   4.0),  -- Chimaeze Ohajianya — Chimaeze Ohajianya (REB)
    ('18f76a23-3a80-47b9-8b18-f4959f76f65e',   3.0),  -- Chimobi Eberechi — no workbook match, floor
    ('34d299d5-acbc-470a-8cf2-810679fef343',   3.0),  -- Chinedu Agwu — no workbook match, floor
    ('a5e7c86d-fe37-4ce8-a3ab-e082b35fc418',   3.0),  -- Chinedu Azodoh — no workbook match, floor
    ('75811ee7-1cc0-42f1-970d-b7c90ff0e803',   3.0),  -- Chinedu C — no workbook match, floor
    ('9386baf0-0970-4b7f-b547-ef8d3e4f032c',   3.0),  -- Chinenye Daniella — no workbook match, floor
    ('add4f371-8515-440f-bad4-1acec5af9cc7',   3.0),  -- Chinwendu Kalu — no workbook match, floor
    ('ee86b370-0577-42a4-a4c3-21c2cdb60d65',   3.0),  -- Chinyere Ikeata — no workbook match, floor
    ('8c1e55b3-cc6f-4d94-b432-57d67ef7dc69',   3.0),  -- Chioma 30 — no workbook match, floor
    ('32fd646c-c4a3-4f3b-91bf-32888265083b',   3.0),  -- Chioma Uche — no workbook match, floor
    ('09fa79af-e57d-4b12-9bfa-364dd499b134',   3.0),  -- Chisom Umeh — no workbook match, floor
    ('469a78bb-cafa-4986-86e9-7424e1a296bd',   3.0),  -- Christopher Nwadike — Christopher Nwadike (WAR)
    ('07756b09-c5e1-4e05-824e-548ead86cc3e',   3.0),  -- Chukwuemeka Alagwu — no workbook match, floor
    ('517750e6-5814-4e41-b48b-38004cff0730',   3.0),  -- Chukwufumnanya Oranye — no workbook match, floor
    ('a433881a-3b65-4601-82b5-a334e9f32672',   3.0),  -- Chukwuma Monye — no workbook match, floor
    ('f56b7654-e5bb-49e3-b8a4-b814bb0e2520',   3.0),  -- Clement Tolulope — no workbook match, floor
    ('f38588f7-cc6c-45ed-8a68-36165f723da1',   9.0),  -- Clinton Koko — Clinton Koko (WAR)
    ('aeb099f5-f70a-4ad0-b2a5-c4ee47a6a94d',   9.0),  -- Confidence Nzurumike — Confidence Nzurumike (WAR)
    ('1126294c-355d-4a4e-a393-762deab965e4',   3.0),  -- Cynthia Ogochukwu — no workbook match, floor
    ('62654065-6293-4316-b2d1-3b3b629b5735',   3.0),  -- Cythia Uzoma — no workbook match, floor
    ('0ac1c664-c42f-4d71-883c-d6b78a28d1c0',   3.0),  -- Dabira Jacob — no workbook match, floor
    ('47fab612-64fc-4fac-a97b-94054558a2b1',  12.5),  -- Dabo Green — Dabo Green (LAK)
    ('ca8080d5-5d0d-414a-a93f-a318188d9d14',   3.0),  -- Dabobelema Dimieari — no workbook match, floor
    ('8ebf28ba-160f-4456-a654-18113f82f600',   3.0),  -- Dami Caulrick — no workbook match, floor
    ('3ce52317-d8ef-4dd6-ba73-85b390c45c08',   3.0),  -- Damilare Olapade — Damilare Olapade (ALP)
    ('8e62e6d1-d533-4426-ad46-d5876f376d4f',   3.0),  -- Damilola Olalegan — no workbook match, floor
    ('db535f81-c1a3-4f0a-92ed-8ab1230490c6',   3.0),  -- Damilola Olalegan — Damilola Olalegan (LAK)
    ('41737002-10f1-4ec8-9f84-0f5894676d4e',   7.5),  -- Damilola Olubode — Damilola Olubode (REB)
    ('d388c220-3272-4f71-a894-4597efa4faeb',   3.0),  -- Damola Adeyemi — no workbook match, floor
    ('83453d46-f04f-4acb-8501-ca6acf9a3814',   3.0),  -- Daniel Davies — Daniel Davies (PAN)
    ('84feb760-e40f-4e65-8980-873ad26dde68',   8.5),  -- Daniel Denzel Davies — Daniel Denzel Davies (ALP)
    ('c41b262e-f6e0-4de4-a70f-56989ce4ea13',   3.0),  -- Daniel Godfrey — no workbook match, floor
    ('c3635c81-9a57-44fb-8475-f238e1aebb9b',   3.0),  -- Daniel Obi — no workbook match, floor
    ('6fa945ef-f468-4025-a052-79910e43afe2',   3.0),  -- Danielle Ukaogo — no workbook match, floor
    ('e3e3dca6-99a8-460b-802d-9651a7fc6524',   4.0),  -- Danjuma Gideon — Gideon Danjuma (RAP)
    ('646c2823-2cb3-4624-9295-abebaacfa381',   3.0),  -- Dauda Oluwayinka — no workbook match, floor
    ('9160b5ac-8cac-406b-a673-e49bf8b9ca89',   3.0),  -- David Everett III — no workbook match, floor
    ('956d952c-717b-4153-aaf2-37fa40b63503',   3.0),  -- David Livingstone — no workbook match, floor
    ('16b51035-329e-49d7-b5c3-5fecad04b4ad',  11.5),  -- David Ojomo — David Ojomo (ALP)
    ('fa0f8793-c7ff-436b-88e8-66e5e2accb4a',   3.0),  -- David Omadhebo Ovie — no workbook match, floor
    ('b75bfe76-7bbb-4eff-81ae-ed1e24a6095a',   3.0),  -- David Somtombe Madu — no workbook match, floor
    ('634ceced-f133-4035-81f4-e92571e7ddd1',   6.0),  -- Deborah Adekunle — Deborah Adekunle (ALP)
    ('b2380935-258f-40a6-baf8-4bd2395e7ecb',   4.5),  -- Deborah Awoniyi — Deborah Awoniyi (GBK)
    ('805d4494-6767-4af4-9a62-2a05abae25a6',   3.0),  -- Deborah Idowu — no workbook match, floor
    ('2630cd1d-5929-45ef-b9b7-709905bdd0e4',   3.0),  -- Deborah Oni — no workbook match, floor
    ('d0d42b32-a814-48f9-acd9-dcae6004d794',   3.0),  -- Deji Adejuyigbe — no workbook match, floor
    ('6a5e885c-0757-4c65-8865-c5e7aaec3fbd',   3.0),  -- Derek Martins — no workbook match, floor
    ('4b1c8191-8dbe-469d-96a4-aaa456f9fbaa',   3.0),  -- Destiny Ataga — Destiny Ataga (ALP)
    ('40229b2c-1560-4bf1-893e-466e29d9f8f8',   3.0),  -- Destiny Irabo — no workbook match, floor
    ('61e5d9c2-64bd-4262-87e6-def25781370f',   3.0),  -- Dike Emmanuel — no workbook match, floor
    ('6bbab8b6-735e-49f3-9fdd-40c65eadb024',   3.0),  -- Dimeji Ojora — no workbook match, floor
    ('ade49b47-6de7-4561-9abe-e6b612af002e',   3.0),  -- Dimieari Dabo-Green — no workbook match, floor
    ('28c727bb-f96e-442f-a92e-df986c493c2e',  11.5),  -- Divine Chidera — Divine Chidera (GBK)
    ('387fd0c8-deda-48a0-add4-30a57db1abb9',   9.5),  -- Divine Eric — Divine Eric (REB)
    ('ebd4a1a6-3793-4705-b4df-2186fb4c6971',   3.0),  -- Divine Nathaniel — Divine Nathaniel (RAP)
    ('494d0773-d59c-4020-80c7-37f67eb20b9c',   3.0),  -- Dolapo Kukoyi — no workbook match, floor
    ('c5b357b9-0c5c-444d-8d21-ea31f85d2c97',   3.0),  -- Dolapo Robert — no workbook match, floor
    ('f2ebd622-9f52-469a-892e-bc814435f77f',   9.0),  -- Donald Akuwudike — Donald Akuwudike (PAN)
    ('6917de9b-9572-451d-89db-bda6c1b971c3',   3.0),  -- Donald Onyema — no workbook match, floor
    ('3ce54d58-4c04-4aca-a1e0-e1df6e7929e6',   3.0),  -- Duro-Ladipo Olatoye — no workbook match, floor
    ('eda5132b-6e63-4088-bae9-1b26b18fa28d',   3.0),  -- EL Rellher — no workbook match, floor
    ('36e5097d-a1d1-4385-b434-68d288921295',   3.0),  -- Ebube Njere — no workbook match, floor
    ('726c93d5-a7e6-4e6d-a419-48d7c7352718',   3.0),  -- Edirin Igwele — no workbook match, floor
    ('9872ec2b-f89a-4d3c-868a-e10b6de5f3a6',   3.0),  -- Edith Eronini — Edith Eronini (REB)
    ('c9d11a10-1dcf-414e-84b4-cd72f6734cfe',   3.0),  -- Egbetunde Ruth — no workbook match, floor
    ('6745dc3e-7999-4374-b17c-cb1615405cc5',   3.0),  -- Ehijie Egualeonan — no workbook match, floor
    ('8e89c3fe-08ea-4771-9226-df3786eb30d9',   3.0),  -- Ekemini Nsikak — no workbook match, floor
    ('55acd9be-214c-43e6-9f9e-b5cbbed4fb3d',   3.0),  -- Ekomobong Udonwa — no workbook match, floor
    ('8cd918af-9bab-44f5-bec8-2124eb764f0e',   3.0),  -- Ekor "O2U" Ibor — no workbook match, floor
    ('89e7abb0-18ab-4b95-8f88-3473046c0cd2',   3.0),  -- Ekundayo Tobiloba — no workbook match, floor
    ('692e7eb4-b085-41ef-a367-ff75a817930a',   3.0),  -- Eliemenya Howell Kachikwu — no workbook match, floor
    ('904137e3-db78-4041-816a-b386e3ca5087',   3.0),  -- Elizabeth 20 — no workbook match, floor
    ('95075efd-af01-40a4-bc8f-6e19d0c2352f',  12.0),  -- Emeka Alagwu — Emeka Alagwu (LAK)
    ('c523a89c-cb8b-4e59-bed6-0e04cf1c5f26',   4.5),  -- Emmanuel Adegalu — Emmanuel Adegalu (GBK)
    ('a0aa709c-4fce-4069-b0ba-f8fa88de4c5a',   3.0),  -- Emmanuel Adoyi — no workbook match, floor
    ('9f4d3b75-ed52-4250-9820-f0e7b7badc10',   3.0),  -- Emmanuel Eze — no workbook match, floor
    ('c6334920-d600-46c4-9aed-3e54457421e6',   5.5),  -- Emmanuel Madu — Emmanuel Madu (REB)
    ('cef4f476-c42d-43f3-8069-bda430f3bcca',   3.0),  -- Emmanuel Oche — no workbook match, floor
    ('a859f99b-30dc-4005-b21c-0118b66b0e4e',   8.0),  -- Emmanuel Ojirinnaka — emmanuel ojirinnaka (GBK)
    ('2b6a0cd5-4301-4737-a331-0031cc2486ff',   3.0),  -- Enyinnaya Ogenna — no workbook match, floor
    ('b5fb600d-591e-4f2d-85f6-96469224e95c',   3.0),  -- Ephraim Faloughi — no workbook match, floor
    ('15c11293-2b14-4869-a2d0-f1b1e1aa9022',   4.5),  -- Erie Destiny — Erie Destiny (HNS)
    ('1f4409a4-901b-4fc8-8e91-095693ce8d66',   3.0),  -- Ester Mathew — no workbook match, floor
    ('9fc56f51-97dc-49e1-9db6-5893297aca91',   3.0),  -- Esther Badmus — no workbook match, floor
    ('60bd8ad4-4156-43ec-adc5-697ea24b0fd4',   3.0),  -- Esther Matthew — no workbook match, floor
    ('d44d8aaf-d3ee-4a37-ae14-999ea9d848a7',   7.0),  -- Esther Odeyemi — Esther Odeyemi (PAN)
    ('056a2270-4d78-46d5-a410-23d1e4440008',   9.5),  -- Esther Okorougo — Esther Okorougo (PAN)
    ('755eab15-2491-4562-ac5d-5f79abdb39c7',   4.5),  -- Esther Oyeyemi — Esther Oyeyemi (IKN)
    ('3bfa8d67-6642-40e3-80e8-d7d97daaaeeb',   3.0),  -- Etoroabasi Matthew Udoh — no workbook match, floor
    ('2302b32f-5482-49b7-8375-ca51e2c24a94',   3.0),  -- Etoroabasi Udoh — no workbook match, floor
    ('6c1142d5-cefa-46ae-9068-368077333567',   3.0),  -- Evelyn Etti — no workbook match, floor
    ('70d4921f-3dde-407d-b884-f7b554667e4e',   3.0),  -- Fadipe David — no workbook match, floor
    ('e6589def-487d-432b-a2fe-54e94e2c3861',   3.0),  -- Fagha Faloughi — Fagha Faloughi (LAK)
    ('81d374f8-4de3-4dd5-9dbe-acab75c12364',   8.0),  -- Faruk Amoo — Faruk Amoo (PAN)
    ('84a171d1-112d-44aa-9e4b-03c797185f47',   9.5),  -- Fatai Praise — Fatai Praise (LAK)
    ('b3577517-4b81-4285-957b-faa2227596ac',   3.0),  -- Fatima Adegbindin — no workbook match, floor
    ('111ad128-8d5c-4ab2-9ec2-934153dec858',   4.5),  -- Fatungase Jabar A. — Fatungase Jabar A. (WAR)
    ('d7e72c68-3b08-4199-9c02-6e1fc70c2640',   3.0),  -- Favour Anari — no workbook match, floor
    ('7f9ba361-2846-489c-9ae3-e010f8a17f40',   3.0),  -- Favour Emechete — no workbook match, floor
    ('8bca167f-c60e-4e35-bb81-b0f01b4a4f11',   3.0),  -- Favour Enitilo — no workbook match, floor
    ('ad486aaf-a2ea-4461-ac61-d6278a8f590d',   3.0),  -- Favour Eric — no workbook match, floor
    ('048943b2-077a-4c77-ba98-84b3f0849455',   3.0),  -- Favour Franklin — no workbook match, floor
    ('97975e3e-2cb0-4a33-aa7a-310dd4d1250f',   3.0),  -- Favour Okeoghene — no workbook match, floor
    ('59ece075-9f43-4b0a-b48a-679675f1eff2',   3.0),  -- Favour Uzochukwukwadoe Emechete — Favour Uzochukwukwadoe Emechete (BRV)
    ('6b453500-a3ea-4cec-b136-449af0fea7a5',   3.0),  -- Fawas Junaid — no workbook match, floor
    ('5670fb91-217b-40ba-9886-8b9eda19bda1',  11.5),  -- Fawaz Azeez — Fawaz Azeez (REB)
    ('495798c7-404f-48e1-9666-a43a8372f26c',  10.0),  -- Fawaz Junaid — Fawaz Junaid (ALP)
    ('db49cacd-a7b4-49ca-8925-ae3045bff5de',   3.0),  -- Femi Ajala — no workbook match, floor
    ('d29282eb-0f67-4d29-bf23-16258bc2b9ef',   8.5),  -- Folorunsho Shuaib — Shuaib Folorunsho (GBK)
    ('151c057d-f576-424e-9f7f-a7231146fb39',   3.0),  -- Fortune Anslem-Ibe — no workbook match, floor
    ('644543d1-b2f7-4b84-b819-d3597f995536',   3.0),  -- Fortune Meremoth — no workbook match, floor
    ('b299c2c8-ec2b-4adc-8a04-ffef1388e804',   5.5),  -- Freeman Oloteome — Freeman Oloteome (ALP)
    ('bfb78caa-4c55-4b95-b78a-5cb91c3d724c',   3.0),  -- Funmilayo Bamigboye — no workbook match, floor
    ('64e9efc1-1855-4eb2-8316-532aea4f24b3',   3.0),  -- Gabriel Ene-ita — no workbook match, floor
    ('05b42b04-a2d3-4672-9329-4b0af82fede7',   3.0),  -- Gabriel Perez — no workbook match, floor
    ('d4a80583-704b-4648-becc-7bc7b11008c7',   3.0),  -- Gabriel Simon — Gabriel Simon (RAP)
    ('57c2f29b-4e58-453f-9245-aa9514100ef2',   3.0),  -- Garba Azeez — no workbook match, floor
    ('832a1c56-058c-42fe-84ce-554409cfe483',  10.0),  -- Garuba Aishat Olamide — Garuba Aishat Olamide (PAN)
    ('bbb0034d-ba03-4777-8454-7dda549f5fc4',   3.0),  -- Gbamire Grace — no workbook match, floor
    ('581d7454-b620-4f35-984f-bf818143082a',   3.0),  -- Gbenusola Damilola — no workbook match, floor
    ('077c4638-afc0-4f57-8cf1-8428e0ab5203',   3.0),  -- George Emmanuel — no workbook match, floor
    ('0fedfe01-d5eb-4a0c-b24e-c440eb1974a4',   4.5),  -- George Success — George Success (HNS)
    ('a86b8404-2f04-4b2b-babe-ff4cc9df74c7',   3.0),  -- George Uzomba — no workbook match, floor
    ('75b7b37e-4462-4827-95de-7ec0c7d1592d',   3.0),  -- Gerard Obiebi I. — no workbook match, floor
    ('40338dbb-6d03-4b89-9bc3-8f8581152924',   5.5),  -- Gift Angel Clinton — Clinton Angel Gift (IKN)
    ('c00118db-80e8-4af1-93ea-8202a99817ea',   3.0),  -- Gift Clinton — no workbook match, floor
    ('276e6bbc-976a-4f65-91c5-0f9dee5ddded',   3.0),  -- Ginika Ozodinobi — no workbook match, floor
    ('18a93a4b-3cc6-43f3-bb22-fefe5ce3a917',   3.0),  -- Giovanni Onobun — no workbook match, floor
    ('f9b1a39f-4362-46ea-bd12-74d0e204cf8d',   9.5),  -- Giovanni Onobun — Giovanni Onobun (LAK)
    ('001f7b7d-1236-44fd-af8c-f10e9d458eed',   3.0),  -- Gladji Miracle — no workbook match, floor
    ('3c007be5-f30b-4a82-9240-4dc78ff64a4e',   3.0),  -- Glory Kasi — no workbook match, floor
    ('e1a4b7d8-22f8-4511-9ea9-19ede446f2b8',   3.0),  -- Goddey Divine — Goddey Divine (ALP)
    ('71315b81-54e6-46ca-bca8-6b45e4aa6851',   3.0),  -- Godfrey Divine — no workbook match, floor
    ('872c80aa-1c1f-4c1e-8a0b-b0e9c9ff4781',   3.0),  -- Godspower Ginika Ofoegbu — no workbook match, floor
    ('7d2c6f82-006a-42e5-90c2-d2a9d22f3272',   3.0),  -- Godswill Akunebu — no workbook match, floor
    ('566629a6-4da2-4a18-a479-06d0bba15d01',   3.0),  -- Godswill Akunwbu — no workbook match, floor
    ('619a0b1a-36f1-48de-9788-f72879c70e8f',   4.5),  -- Godswill Atibile — Godswill Atibile (IKN)
    ('16c8c89f-9c10-4089-9099-49df7ba4bf4b',   3.0),  -- Godswill Atibile — no workbook match, floor
    ('980e51d1-829b-479b-990e-4c484bb75996',   3.0),  -- Godswill Chuku — no workbook match, floor
    ('e1d34321-a872-4c2d-9858-c195ecaf8765',   6.0),  -- Godswill Willie — Godswill Willie (ALP)
    ('9f49c351-bd5d-4200-95c5-8404f3284ffe',   3.0),  -- Godwin Omale — no workbook match, floor
    ('6cc79ee0-a7e5-49b4-aaf4-32b2d12312d4',   3.0),  -- Goodness Nwobodo — no workbook match, floor
    ('83e9af9d-32ef-4243-b11a-1c6a42e639f2',   3.0),  -- Great Okenwa — Great Okenwa (BRV)
    ('2de792e2-58db-449a-af7e-06cb04449102',   3.0),  -- Greg Unaseru — no workbook match, floor
    ('b951b5f9-3c94-4a1f-8172-20e63412d8d0',   3.0),  -- Gregory Uanseru Jnr — no workbook match, floor
    ('0f58e1fe-c1fe-4588-ac0e-54b9ba3eb792',   3.0),  -- Habibat Ismail — no workbook match, floor
    ('36c3f6ec-5eb1-4f96-8ab2-40ee7e183a89',   3.0),  -- Habitat Ismail — no workbook match, floor
    ('c693f4ca-1e15-4958-857d-c75b60c21e67',   6.0),  -- Hammed Rodiat — Hammed Rodiat (HNS)
    ('ceef1ef6-a436-421d-89f4-519dc0944000',   3.0),  -- Hamza Adisa — no workbook match, floor
    ('16f8abba-8aae-40f5-8f4d-02cc151eff11',   3.0),  -- Happiness Aondoaseer — no workbook match, floor
    ('a95bf86f-b195-43b3-95a4-2e5d1dffeced',   3.0),  -- Harrison Blessing — no workbook match, floor
    ('3291b6fc-15e8-4e62-a31e-2d9b0cb5e065',   3.0),  -- Hawa Adam — no workbook match, floor
    ('2a807202-fd79-43f3-8988-12db4395b586',   4.5),  -- Hawawu Temitope — Hawawu Temitope (HNS)
    ('c9331c92-798b-4357-a9f5-e541763c262e',   3.0),  -- Helena Ayewe — no workbook match, floor
    ('b5a8583f-b7cc-4fba-9f62-3875e977ae4a',   3.0),  -- Hembam Vera Sewuese — no workbook match, floor
    ('2fa3f2f8-fcda-4f91-a094-7fb06b683c13',   3.0),  -- Hope George — no workbook match, floor
    ('39dfef78-1725-49d2-bf37-a8877cdb6ce1',   3.0),  -- Ibibo Seleye-fubara — no workbook match, floor
    ('a90135e2-782a-4f76-a335-c4ff082de850',   3.0),  -- Ibikunle Mutiat — Ibikunle Mutiat (GBK)
    ('f2e72349-d514-4e20-9818-ab5501232374',   3.0),  -- Ibinabo Jefferson — no workbook match, floor
    ('a82b57de-a2dd-492e-a1fd-7bb56860d104',   8.5),  -- Ibrahim (Franklin) Raheem — Ibrahim (Franklin) Raheem (HNS)
    ('8d691eef-e412-4a41-a87b-0126e3a937f0',   3.0),  -- Ibrahim Hassan — no workbook match, floor
    ('183a4a23-01ab-4f8b-8594-1b13defbb387',   3.0),  -- Ibrahim Kosoko — no workbook match, floor
    ('81ebe7e8-71b8-415a-a162-5c39c08b7a83',   3.0),  -- Ibukun -Tutu Eletu — no workbook match, floor
    ('b6dd320a-c322-4899-aa10-160e9a50220e',   3.0),  -- Ibukun Tutu Eletu — no workbook match, floor
    ('db5f9e42-d9ac-4b17-b807-920c95731227',   3.0),  -- Idongesit Godwin — Idongesit Godwin (ALP)
    ('ff05f500-4277-46de-89bb-c8ea75ec1420',  12.0),  -- Ifeanyi Anine — Ifeanyi Anine (IKN)
    ('998e16fb-45e5-48c6-9e0e-7c91d8b440db',   3.0),  -- Ifekwem Divine Wayne — no workbook match, floor
    ('1c9bba84-4e77-4326-a8fe-10e37b45e6fa',   3.0),  -- Igbinoba Priscilla — no workbook match, floor
    ('841e121c-bf17-4849-86b0-f2af7c2d85da',   3.0),  -- Igwe Ebube — Igwe Ebube (PAN)
    ('e06c8486-6571-4777-b240-f6dacddb3f77',   3.0),  -- Iheme Ikenna Arthur — no workbook match, floor
    ('9663bdf2-025e-4a70-b632-0d74db83c506',   3.0),  -- Ijeoma Nwoke — no workbook match, floor
    ('0c4fe184-4d51-47a7-8229-924b25aa55aa',   9.0),  -- Ikechukwu Scott — Ikechukwu Scott (BRV)
    ('5f8a0482-c100-4180-bef9-135915eb4452',   3.0),  -- Ikhuoria Peace — no workbook match, floor
    ('a57eafaf-4f83-4c0f-ba64-f9d75038acb0',  10.5),  -- Imoleayo Madamidaola — Imoleayo Madamidaola (RAP)
    ('9dcb559b-bbcb-4c8d-96b5-473ec4f90468',   9.5),  -- Ipense Oloruntoba — Ipense Oloruntoba (WAR)
    ('e52d9c66-6d91-4c29-9dd9-22bed465adea',   3.0),  -- Isaac Unwana James — no workbook match, floor
    ('23bdfe26-7226-407a-be66-6c1f503a9b10',   3.0),  -- Isaac Wright Muse — no workbook match, floor
    ('cc83202f-00b8-4f8b-a9f5-0eb55bd3a741',   3.0),  -- Iscandrill Momoh — no workbook match, floor
    ('47063ef3-5353-48b2-a64b-7b83e49adcf0',   3.0),  -- Israel Onyeogaziri — no workbook match, floor
    ('23f53d02-50fd-4144-9dd2-d1becbd85e0f',   3.0),  -- Isreal Ibitoye — Isreal Ibitoye (REB)
    ('8ee2e787-fba6-419d-bfdd-0740ea5bdc42',   3.0),  -- Itsukwi John — no workbook match, floor
    ('d998aed6-1d81-4efe-ae67-0022c6cf7e21',   3.0),  -- Itua Victor — Itua Victor (WAR)
    ('b3c9cb2e-2766-416c-afa3-7d1ee1379652',   4.0),  -- Iudoyibo Ifeoma Goodluck — Iudoyibo Ifeoma Goodluck (GBK)
    ('b246613c-ff3a-4cce-aa54-70a235417045',   3.0),  -- Iwunze Uchenna — no workbook match, floor
    ('025e69ec-baa5-4957-a8da-3b9aed46d2f4',   3.0),  -- Ized Uanikhehi — no workbook match, floor
    ('3e838947-5011-4125-b482-196ddd39078e',   9.5),  -- J Fem — J Fem (BRV)
    ('3d7f2fa5-f488-4af7-8975-1aaa6df8e505',   3.0),  -- Jamal Kasumu — no workbook match, floor
    ('0d036784-be5b-47e1-8cbc-26c85a2e37d7',   3.0),  -- James Daniel Odey — no workbook match, floor
    ('8f14ac31-060a-497b-9227-b03286098dc1',   3.0),  -- Jason Anozie — no workbook match, floor
    ('a55f41e8-7ba4-4a82-92e6-c8729e660c2e',   9.0),  -- Jedidiah Santana Oluremi — Jedidiah Santana Oluremi (BRV)
    ('68f9af73-416b-42e5-942e-0ece2b947795',   3.0),  -- Jefferson Ibinabo — Jefferson Ibinabo (BRV)
    ('ebd20994-8caa-43d0-bc0d-508b2104ad38',   3.0),  -- Jeffrey John — no workbook match, floor
    ('b730375b-310c-4b5a-9720-1d4e7019208c',   3.0),  -- Jeffrey Osahon — no workbook match, floor
    ('c8df974a-724d-4699-b5e3-e15d1fb55553',   3.0),  -- Jenrola Medoye — Jenrola Medoye (PAN)
    ('0732831f-8ccf-4d06-b6a8-e393b16d552b',   3.0),  -- Jessica Alawuru — no workbook match, floor
    ('54f5369a-a606-4c0b-bf6a-1e19c41709ef',   3.0),  -- Jesuyanmi Oluwasanmi — no workbook match, floor
    ('ddc23043-2f88-4158-ad40-f2c9e189e111',   3.0),  -- Jimmie Akinsola — no workbook match, floor
    ('cca07e85-f97c-4a88-9dcd-ce3ad769b2d8',   8.0),  -- Jimmie Akinsola — Jimmie Akinsola (LAK)
    ('27a715af-769c-47d5-ad12-657f25364474',   8.5),  -- Jite Ughojor — Jite Ughojor (PAN)
    ('acadc0da-ab0d-481c-85f0-533cd8990821',   3.0),  -- Joel Udeh Obed — no workbook match, floor
    ('e708006d-1a52-4c05-b20e-81a7efa61e61',   3.0),  -- John Audifferen — no workbook match, floor
    ('1ae27c87-90b7-49c1-8701-b8ae206b6bb5',   3.0),  -- John David Gbenga — no workbook match, floor
    ('39e796d3-c15d-42df-8794-4644407719fd',   7.0),  -- John Itsukwi — John Itsukwi (WAR)
    ('d4e76d05-a2cc-4a0d-8c7a-02d692874483',   3.0),  -- John Jesufemi — no workbook match, floor
    ('cda35f8d-3c74-4595-ab2c-1badf3a1d2bd',   3.0),  -- John Mufasa — no workbook match, floor
    ('c3e3ebad-64a7-4c9c-8fbe-19a6206bab3b',   3.0),  -- Jonathan Adaeze — no workbook match, floor
    ('d9c5e263-780f-45f8-b866-b504ba2d166d',  11.5),  -- Jordan Nathaniel — Jordan Nathaniel (WAR)
    ('732d0385-18ac-4eab-9c53-6610ec94169e',  12.5),  -- Joseph Williams — Joseph Williams (WAR)
    ('a2a2248f-65e3-4ccf-9034-df7bd1c7e203',   3.0),  -- Joshua Daniel — no workbook match, floor
    ('fc2a0586-ab93-4585-b786-880ee1162625',   4.5),  -- Joshua Eritobor — Joshua Eritobor (HNS)
    ('d4eee255-b435-4246-9a38-ae14b55b9590',   3.0),  -- Joy Ebeiga — no workbook match, floor
    ('170ec958-3538-4efb-8dc5-c24b3727f815',   3.0),  -- Joy Ebiega — no workbook match, floor
    ('41a39f42-1329-4d11-9ff6-d231cdc8f96b',   3.0),  -- Joy Julius — no workbook match, floor
    ('2cc96eeb-8dcc-4b19-935d-a4bbc3e259d9',   3.0),  -- Judah Arowojolu — no workbook match, floor
    ('25af69d8-682d-4480-8f8b-7e50522da5a1',   3.0),  -- Julius Samson — no workbook match, floor
    ('5a90e4e9-4d9d-4e50-b773-0d28021e5116',   3.0),  -- Jumai — no workbook match, floor
    ('97baf6dd-9c06-4372-a83a-19201c5f7994',   3.0),  -- June Uzzi-Daniel — no workbook match, floor
    ('c3810bf3-8df3-46f6-ae41-1f38a9caaac0',   6.0),  -- Junior Lawson — Junior Lawson (RAP)
    ('bf9686c2-752a-43cd-b915-bb7ce491bc03',   3.0),  -- Kaosisochukwu Mbachu — no workbook match, floor
    ('d76bb744-8549-474f-aacf-70a2ade3a4e0',   3.0),  -- Kareem Balikis — Kareem Balikis (ALP)
    ('38825f40-907e-4a68-8594-ff0c40ee6e85',   6.0),  -- Kareem Suliat — Kareem Suliat (IKN)
    ('9f0f17ac-eef1-4e60-b77f-d8455fd69475',   3.0),  -- Kate Johnson — no workbook match, floor
    ('6c6386fb-4e68-4bdf-afc1-c19781caab81',   3.0),  -- Kaycee Kingsley — no workbook match, floor
    ('25f102c0-bd38-4430-9567-5539da9d4897',   3.0),  -- Kayode Mafe — no workbook match, floor
    ('8ca08508-8445-4f94-a249-7bb232595fd9',  12.0),  -- Kayode Mafe — Kayode Mafe (LAK)
    ('dd5ef3ab-840b-48f9-8c56-88d81479b823',   3.0),  -- Kehinde Jesutofumi — no workbook match, floor
    ('c1949fb2-f9d2-44ab-9238-7072a14d6346',   3.0),  -- Kehinde Sokunbi — no workbook match, floor
    ('8b2b42fa-7553-4078-8741-1df4d8456dac',   3.0),  -- Kelechi Anorue — no workbook match, floor
    ('66a76cfb-935b-45c2-9079-76569d8be8f8',   4.5),  -- Kelsey Charleston — Kelsey Charleston (RAP)
    ('4f7ff780-d4ad-482d-992e-de42bd89164d',   6.5),  -- Kelvin Kougninou — kelvin kougninou (PAN)
    ('e527ea0e-4cba-4d32-a1a7-9f122743e879',   3.0),  -- Kemi Ajadi — no workbook match, floor
    ('167adfee-d3e9-4909-a042-0e406d0788a8',   3.0),  -- Kenny Nwankwo — no workbook match, floor
    ('9dd35085-461d-45a8-8851-a6ec80b1ad56',   3.0),  -- Kevwe Adjuya — no workbook match, floor
    ('8b50bbd1-dd5a-4a2b-9526-41561744cb8b',   3.0),  -- Kobodokunni Scott — no workbook match, floor
    ('b6cf3d34-c541-4d6e-ba6b-1f9a172a3cdd',   3.0),  -- Koleoso Oluwakemi — no workbook match, floor
    ('8582ef76-b839-4df0-aff8-d80132535fab',   3.0),  -- Laguda Suliat — no workbook match, floor
    ('8858aea2-38ed-470b-bf67-17fa68195db6',   3.0),  -- Latif Olusesi — no workbook match, floor
    ('45dbe906-10de-44c0-9e87-900501581ed8',   8.5),  -- Lauretta Gabriel — Lauretta Gabriel (PAN)
    ('0b3703ce-04ed-42fe-a99a-20b8bf4088d6',   3.0),  -- Lawal Aminat Kehinde — no workbook match, floor
    ('6f871bb3-b0f1-4dea-b1b0-a6de0c380a59',   3.0),  -- Lawal Happiness — no workbook match, floor
    ('1bcb96f7-ffcf-45c2-bd39-b29c24e6c881',   3.0),  -- Leonard-James Ekechukwu — no workbook match, floor
    ('e7c42fab-7c84-43a8-bb43-862dd7622e5f',   3.0),  -- Lia Aliandu — no workbook match, floor
    ('35d5c9ca-581a-4650-9fae-f6d79a7387c0',   3.0),  -- Louisa Asor — no workbook match, floor
    ('4f661290-a415-43ed-84e8-10e8882e1908',   3.0),  -- Loveth Abubakar — no workbook match, floor
    ('04a38b59-c756-46c5-a009-c0d3f6f8980b',   3.0),  -- Malik Balogun — no workbook match, floor
    ('1fe20889-81ea-48cf-9108-7555702a4737',   3.0),  -- Mariam Bakare — no workbook match, floor
    ('cb06885a-07f8-4e2d-bf90-834281f4a02b',   3.0),  -- Mariam Bakare — no workbook match, floor
    ('f3d758fd-5f81-4deb-b492-8a5af3333d64',   3.0),  -- Mariam Ene — no workbook match, floor
    ('eedf0282-07ef-4f15-8e6b-96de26b0252f',   3.0),  -- Mariam Ojo — Mariam Ojo (PAN)
    ('340f370d-34c0-4965-bd06-e11aae5f667b',   3.0),  -- Marion Franklin — no workbook match, floor
    ('232d206a-5fde-4226-9eb0-b5e665ab2f90',   3.0),  -- Martin Aziba — no workbook match, floor
    ('84862db1-4d46-4662-92fd-3a6100c8d305',   3.0),  -- Marvelous Charles — no workbook match, floor
    ('06201bb0-e71b-4536-b02c-80b5b0851bbc',   3.0),  -- Mary Chibuzor — no workbook match, floor
    ('0ffba072-5075-4d26-a5ce-dec1f803113f',  10.5),  -- Mary Nwakiye — Mary Nwakiye (LAK)
    ('acae63b0-fc09-42b7-ba54-2de506a288f5',   5.5),  -- Mary ohobu Ogbonaya — Mary ohobu Ogbonaya (PAN)
    ('f596a246-5c6f-4c72-b727-d89b8d585ad6',   3.0),  -- Maryjane Anikam — no workbook match, floor
    ('a34a742b-486d-4fd2-afc4-d24ebecf56cb',   3.0),  -- Maryjane Oforchukwu — no workbook match, floor
    ('8e00430b-1514-4f52-aae2-1e19f9ed9fd9',   9.0),  -- Maudleen Julius — Maudleen Julius (LAK)
    ('6667a384-4ffa-4f1e-bf77-5fb3a263be37',   3.0),  -- Maureen Comrade — no workbook match, floor
    ('8c008f33-3fe0-4cc4-8607-e3316bacdcd6',   3.5),  -- Maverick Chukwuemeka — Maverick Chukwuemeka (ALP)
    ('21556268-752a-4acf-9bcb-5d6b6e87b311',   5.0),  -- Messi Nwobodo — Messi Nwobodo (ALP)
    ('bf599d2f-c515-42a4-9b2c-68bedd2b7dec',   3.0),  -- Mgboh Chiamaka Tessy — no workbook match, floor
    ('401a8c37-9fd0-49a0-93bd-25faffb05bd3',   3.0),  -- Michael Okiki — no workbook match, floor
    ('c12a01e4-67db-468a-beb3-85761dc92847',   3.0),  -- Michael Oluwaseun — no workbook match, floor
    ('b7cd52b6-f535-4bef-9f6a-f0e28fcd221d',   3.0),  -- Michael Simon — Michael Simon (ALP)
    ('89bafe62-358d-4e36-973e-81ff1ae91a66',   3.0),  -- Micheal Amajie — Micheal Amajie (RAP)
    ('9aa8be5b-9c52-430c-9886-4420d5df428f',   3.0),  -- Micheal Eyomi — Micheal Eyomi (WAR)
    ('b0393c48-ee0f-4cb2-9121-704bca612810',   9.5),  -- Micheal Ugboma — Micheal Ugboma (RAP)
    ('ef3e9a4e-fbb6-4df2-8348-f47048c094bb',   3.0),  -- Milverton Frimenjibo — no workbook match, floor
    ('cbfa417c-77c2-4e71-9b88-af79a156639d',   5.5),  -- Miracle . — Miracle . (BRV)
    ('69be8ed5-def3-4497-ba1a-8251b82d4388',   3.0),  -- Miracle Glaji — no workbook match, floor
    ('67cde5ca-d6fc-4a79-b404-3882575fb1c7',   3.0),  -- Mistura Oyindamola — no workbook match, floor
    ('522ca091-d171-426e-80af-cd852270c892',   3.0),  -- Mistura Subair — Mistura Subair (WAR)
    ('524b7fb3-1d17-4e92-8e12-53b672518a72',   3.5),  -- Moboluwaji Simeon — Moboluwaji Simeon (BRV)
    ('2b4eba0a-79d4-49b1-95b5-9b1c19ac5ed2',   3.0),  -- Mofeoluwa Akinrinmade — no workbook match, floor
    ('b7bc78c3-f2a9-4f78-bb04-65cd64a25691',   6.5),  -- Mofiyinfoluwa Orojo — Mofiyinfoluwa Orojo (REB)
    ('0810208a-1567-4e19-97e5-84037028d49a',   3.0),  -- Monday OMOROGIEVA — no workbook match, floor
    ('23ff1f8f-6fb1-4981-8d4a-1682c46bbc9f',   3.5),  -- Moses Taiyelolu — Moses Taiyelolu (RAP)
    ('8f8be812-c8cd-4f6b-ac02-0b54eb9b7c81',   3.0),  -- Moshope more — no workbook match, floor
    ('9013b997-a837-40ea-b8b5-2610bc072625',  12.0),  -- Moyosore Adolphus — Moyosore Adolphus (RAP)
    ('62916db1-47c7-45ca-91c0-12cbef6e1299',   3.0),  -- Moyosore Badejo — no workbook match, floor
    ('b1c0f432-61d3-4e8c-b0a2-9efb8b24bed5',   3.0),  -- Mubarak Lawal — no workbook match, floor
    ('315e3e34-6439-42ad-aeac-dd3624157e68',   3.0),  -- Muinat Oseni — no workbook match, floor
    ('0262936b-e1c9-45a1-88dd-7b9de1ff7a99',   3.0),  -- Mukaila Muhammed — no workbook match, floor
    ('be6aabd0-d517-4f79-bfd5-908d3daad0c9',   5.0),  -- Mukaila Rasheedat — Mukaila Rasheedat (IKN)
    ('a00fd290-a89a-4b4e-a1d8-82358860754f',   3.0),  -- Muna Okey-Nwosu — no workbook match, floor
    ('8602f2f5-b070-49b8-88a0-73919f48667f',   3.0),  -- Munachi Okey-Nwosu — no workbook match, floor
    ('cd6c55ec-3a4f-413c-bb74-4c951203864c',  12.0),  -- Mustapha Babatunde — Mustapha Babatunde (RAP)
    ('fc231617-c4eb-48d4-88d2-ea223651c590',   3.0),  -- NK Nwankwo — no workbook match, floor
    ('80fd10a7-336a-4040-b798-1e4a6552deed',  10.0),  -- Nasir Abdulmalik — Nasir Abdulmalik (REB)
    ('53fb7724-2ff0-4770-9360-cdd6384e990a',   3.0),  -- Nathaniel Oluwadamilare — no workbook match, floor
    ('15c8174a-38bb-40a0-b657-29d5a462b4b4',   4.0),  -- Nchor Jnr — Nchor Jnr (IKN)
    ('acf8cb90-e8a7-42ed-a04e-bbcb264bb22a',   3.0),  -- Nedy Udombat — no workbook match, floor
    ('7a0e13d7-dce2-44fa-b34c-61634dd8cbdc',   3.0),  -- Nifemi Sola-ojo — no workbook match, floor
    ('cfe2fb18-6efb-4062-a637-c670d1a84121',   3.0),  -- Nkemjika Okorafor — no workbook match, floor
    ('1278b97e-1c6d-41ce-9f49-ebc9a77626d9',   4.0),  -- Nnamdi Agu Nicholas — Nnamdi Agu Nicholas (ALP)
    ('183df686-922d-4300-8591-78f2ff412df5',   3.0),  -- Nneamaka Anyanwu — no workbook match, floor
    ('0a2a3817-66a6-40f8-a51b-9306c41ac8c4',   3.0),  -- Noble Emmanuel — Noble Emmanuel (WAR)
    ('db4831f7-ebc0-4e8b-a214-15070d3d70d7',   3.0),  -- Nwachukwu Divine — Nwachukwu Divine (HNS)
    ('9940113f-af64-49fa-a834-4716b8d2445a',   5.5),  -- Nwadike Ijeoma Treasure — Nwadike Ijeoma Treasure (BRV)
    ('a94b20d4-c6fb-401e-8041-d71023ffaebd',   3.0),  -- Nwakiye Mary — no workbook match, floor
    ('8cfd8ab5-3dc6-4994-8452-847909d6c432',   3.0),  -- Nwobodo Messi — no workbook match, floor
    ('96a51728-8603-45f4-9627-01c219db93d5',   5.0),  -- Nwokolo Prominence — Nwokolo Prominence (HNS)
    ('469ec418-e31c-4265-bcff-21c58452c540',   3.0),  -- OTU HENSHAW — no workbook match, floor
    ('009ece4a-03dd-4a27-8049-828f9c068856',   3.0),  -- OZIOMA OBIOZOR — no workbook match, floor
    ('1cca364e-ea2f-4163-84cb-d14981c82ce6',   3.0),  -- Obianuju Ngene — no workbook match, floor
    ('0a7126e2-9b38-4157-9110-693d54b09feb',   8.0),  -- Obiekezie Chiamaka — Obiekezie Chiamaka (GBK)
    ('0e20a560-a136-43b4-9a60-69321c510d88',   3.0),  -- Obieze Agbo — no workbook match, floor
    ('55c6077c-9640-48ae-a30b-8ece9438ed05',   3.0),  -- Oche Joy — no workbook match, floor
    ('c23d5884-84c4-4fd7-a176-afad3ada581c',  10.5),  -- Odimbu Awele Gift — Odimbu Awele Gift (HNS)
    ('0a5b438c-806e-4771-920f-10032c262a2d',  11.0),  -- Odudu Otu — Odudu Otu (REB)
    ('fb165f49-1d52-47a5-b0c0-f4fbb8840df1',   3.0),  -- Odutola Qudus — no workbook match, floor
    ('b68ef9a2-f0b0-4229-a6d7-4db4d0cd070d',   9.0),  -- Ogbodu Otega — Ogbodu Otega (WAR)
    ('720222a1-4459-4365-ab1d-76a141fc701e',   3.5),  -- Ogbuo Judy Mathews — Ogbuo Judy Mathews (GBK)
    ('aebbfaed-9e08-466a-b02e-ec0060db7529',   3.0),  -- Ogheneovie Omovigho Orhotaire — no workbook match, floor
    ('9f79e04b-ccbe-4ec3-b40c-03355ece5a65',   3.0),  -- Oghenetega Emakpor — no workbook match, floor
    ('ab32a5a8-0480-4f32-85a8-bb2f5176df60',   3.0),  -- Oguh Uzoma Donald — no workbook match, floor
    ('de122f5b-4e67-414c-ac1b-8e52b61b0a54',   4.5),  -- Ogunmoyede Caroline — Ogunmoyede Caroline (HNS)
    ('0fbfc72a-a596-415b-88cd-fd807226466f',   3.0),  -- Ogunsina Oluwateniola — no workbook match, floor
    ('da2ea2ad-d144-4dc5-baea-0f3d74f7024b',   3.0),  -- Ohenhenlen Jane Iremide — no workbook match, floor
    ('e642dc11-2f13-423b-829d-dd3ee3fd6f8e',   3.0),  -- Ojie Peter — no workbook match, floor
    ('0f670765-58da-4015-b251-b54ca03cbb83',   5.5),  -- Ojone Akubo — Ojone Akubo (ALP)
    ('03cd16f9-2a2c-4e18-8d7d-acf2f9cefe9d',   3.0),  -- Ojugbeli Victor — no workbook match, floor
    ('4447226a-71ca-4d6e-bd19-093894e5b0fd',   7.5),  -- Ojuola Gbemileke Kwame — Ojuola Gbemileke Kwame (IKN)
    ('8f63531b-1d05-4779-a2d6-b67726059cde',   3.0),  -- Okabonye Chukwuani — no workbook match, floor
    ('10ff7308-885e-4694-bef9-bb3e70a14874',   3.0),  -- Okafor Mary Magdalene — no workbook match, floor
    ('0ca45211-23c7-470e-b97d-00621c883bbe',   3.0),  -- Okocha Victoria — no workbook match, floor
    ('386dabcd-f6d8-4cc2-a4b6-7787aa29d7eb',   3.0),  -- Okpowo Kelvin — no workbook match, floor
    ('8647f9b1-fabc-4b33-81b2-63b71346c16d',   3.0),  -- Okunade Habeeb — no workbook match, floor
    ('06fab5f8-21b9-4111-8ca2-2cc297616456',   3.0),  -- Oladejo darasimi — no workbook match, floor
    ('99f049e8-5dba-4e4f-b993-65b3f89e66bd',   3.0),  -- Oladimeji Sulkan Bello — no workbook match, floor
    ('546c499b-1e5d-49ae-a0de-b39e1f8791e0',   3.0),  -- Olamide Oladoyin — no workbook match, floor
    ('df7fb3d9-f6eb-4530-abc8-15220a5f5304',   3.0),  -- Olamilekan Adewunmi — no workbook match, floor
    ('601675d4-f1b1-43f8-ac38-47a7f28a4fa9',   3.0),  -- Olatokunbo Sadiku — Olatokunbo Sadiku (RAP)
    ('30e5ac80-994b-4b1b-a7d5-e2e1568b7777',   6.5),  -- Olawode Jumoke Princess — Olawode Jumoke Princess (ALP)
    ('226c34f3-b82b-4b75-a958-49333e35b8e3',   3.0),  -- Oliver Orok — no workbook match, floor
    ('2c6ca30f-e6c4-4013-a0ee-de26a82fd32c',  10.0),  -- Ololade Olanrewaju — Ololade Olanrewaju (RAP)
    ('515863d3-9bb5-417b-a27b-438aa6d41df3',   8.0),  -- Olonade Valentino — Olonade Valentino (RAP)
    ('f25e5d31-d6ab-49b1-90c3-5f6c8cc9cbf4',   3.0),  -- Olopoeniyan Yusuf — no workbook match, floor
    ('8a793c7f-ff7c-49c0-8fbf-0245b09042ff',   3.0),  -- Oludotun Gbalajobi — no workbook match, floor
    ('1b7bb492-8d96-492e-8222-948862ae271a',   3.0),  -- Olufemi Olagbaju — no workbook match, floor
    ('e2b43170-4481-49ab-a841-cc74f1f71956',   4.5),  -- Olugbani Segun — Olugbani Segun (ALP)
    ('a502fa0c-008c-41fb-8575-dddaea4c144c',   3.0),  -- Olukayode Ayomide — no workbook match, floor
    ('1c7a3731-f38c-49d2-8a15-2bbb8de96a57',   3.0),  -- Olukoya Ajayi — no workbook match, floor
    ('691c069d-27ec-4efd-84f0-a7cea10d25f5',   3.0),  -- Olukoya Riskoyat — no workbook match, floor
    ('af2efa9c-62eb-4228-a707-823be5220031',  10.0),  -- Oluremi Jedidiah — Oluremi Jedidiah (GBK)
    ('c10f39d1-a623-4c8a-b409-8796dc6215be',   3.0),  -- Oluwadamilola Shitta-Bey — no workbook match, floor
    ('cd8e288c-985d-4a7e-a9ab-8e54624274fc',   3.0),  -- Oluwafemi Makinde — no workbook match, floor
    ('67994bf7-3d1a-4be0-829c-a5ad31f81490',   3.0),  -- Oluwakayode Ajayi — no workbook match, floor
    ('c01a2fc3-a707-4245-bf72-3848f961bcde',   3.0),  -- Oluwanifemi Oluwasanmi — no workbook match, floor
    ('e687ac72-c168-409c-8b2e-37403a512ed2',   3.0),  -- Oluwaseun Bamidele — Oluwaseun Bamidele (RAP)
    ('9c04773b-7d70-4794-8d81-4480b83de797',   3.5),  -- Oluwatamilore Fashina — Oluwatamilore Fashina (ALP)
    ('4286d1d1-4532-4341-93ba-ac9194ecb95c',   3.0),  -- Oluwatimilehin Oloidi — Oluwatimilehin Oloidi (IKN)
    ('6d4b9489-2c27-4e49-b7ca-b50fc16bcb94',   5.5),  -- Oluwatobiloba Fasasi — Oluwatobiloba Fasasi (LAK)
    ('5e1c974b-ab68-47cc-9401-81e6f072f0f5',   3.0),  -- Oluwatunmise Zaccheaus — no workbook match, floor
    ('b9df7264-d3dd-4d16-9dbb-214eff7ae817',  12.0),  -- Oluwole Filani — Oluwole Filani (REB)
    ('485988ec-7492-4fa1-a956-73b6b3e6ac92',   9.5),  -- Omadhebo David — Omadhebo David (HNS)
    ('f59c4293-be1c-41a6-989a-1adf2c4e241f',   3.0),  -- Omale Legacy — no workbook match, floor
    ('3e23c1d4-9108-4950-91f9-372ab2a9e45a',   6.5),  -- Omolola Adeseke — Omolola Adeseke (HNS)
    ('01a0efac-f150-4c81-bf3d-b672bdaee992',   3.0),  -- Omoniyi olorunbukola — no workbook match, floor
    ('13edda0a-9fe4-4208-aa6d-9471b4532c65',  11.0),  -- Omosanya Taofeek — Omosanya Taofeek (GBK)
    ('aca29837-b5c8-4799-82a6-14eb7ae0c096',   3.0),  -- Omotosho Ameerah — no workbook match, floor
    ('908fd479-0a98-4611-a63e-d09a5f977c60',   3.0),  -- Onamakinde Oluwabukola — no workbook match, floor
    ('3b6445f7-b636-47a0-802a-f50071da8197',   9.0),  -- Onamusi Oreoluwa — Onamusi Oreoluwa (REB)
    ('5423210b-9dda-41ea-a245-54ed5d0c1772',   3.0),  -- Onyeanwuna Samuel — no workbook match, floor
    ('9f692c39-7010-4499-90da-2d892dfad24a',   3.0),  -- Onyegu Chibuzor — no workbook match, floor
    ('d1cdb93d-dbba-4b97-8c09-8da6ddbd6f90',   3.0),  -- Onyinye 69 — no workbook match, floor
    ('06e7f71c-3754-4eee-a22e-4d87ffaec29a',   7.5),  -- Onyinye Udueze — Onyinye Udueze (REB)
    ('12a169ce-e4b0-4867-8622-f2f367fd3f7d',   3.0),  -- Opeyemi Yusuf — no workbook match, floor
    ('9fc2cb14-cdbf-4a4b-92b2-40d915adebd4',   3.0),  -- Osabor Destiny — no workbook match, floor
    ('1b2f57d1-54e2-44a1-bdf3-972fd68b1737',   3.0),  -- Osasah princess — no workbook match, floor
    ('664b505f-620f-4f20-ac90-0b08a5b7e5ef',   8.5),  -- Oseto Waguan — Oseto Waguan (WAR)
    ('8dc182a5-9756-457d-a702-619928c44cf1',   3.5),  -- Osho Isreal — Osho Isreal (RAP)
    ('a0d33c24-0f94-4538-83fd-317151de382d',   3.0),  -- Osho Tomiehen — no workbook match, floor
    ('f815032c-765f-4064-ac24-1dfb5bbdd2dd',   3.0),  -- Osuya Esther Amaka — no workbook match, floor
    ('0d45b1c5-4861-4dff-a0d7-690dd7da32f0',   3.0),  -- Osuya. Esther — no workbook match, floor
    ('c4d2696a-bd59-4b8b-a3a4-8cb6be29997c',   3.0),  -- Otono Osi Emmanuel — no workbook match, floor
    ('f8957448-8635-4e4d-a9c9-e499fe9a6c8b',   5.0),  -- Ovie Orhotaire — Ovie Orhotaire (ALP)
    ('853b793e-c7ce-4f59-b38e-f6ccccb7e9ed',   6.0),  -- Owen Favour — Owen Favour (WAR)
    ('98348c5c-98e6-4423-a449-222085d3ba64',   3.0),  -- Oyedokun OLAMILEKAN — no workbook match, floor
    ('eedd3817-53fd-4e9e-b7f5-e2a0192be9ca',   3.0),  -- Patience Jackson — no workbook match, floor
    ('56b65b1a-2857-492b-adec-e64c3a1280a7',   3.0),  -- Paul Okoye — no workbook match, floor
    ('ff66c8ac-19d9-46b2-9880-75a1ccc87fa7',   5.0),  -- Peace Ikhuoria — Peace Ikhuoria (LAK)
    ('6d9e5786-ab88-4817-a85a-7c9027bd2cee',   3.0),  -- Perpetual Nmanna — no workbook match, floor
    ('0cc5d272-207c-4b88-8127-b78c71f496a7',   4.0),  -- Peter Abah — Peter Abah (REB)
    ('301daa32-0243-40d4-b35d-c00ece7373d2',   3.0),  -- Peter Peekay — Peter Peekay (ALP)
    ('40d0b287-45f7-452c-aa1e-5827f32d7be8',   3.0),  -- Philip Ikechukwu — no workbook match, floor
    ('19e22b81-2d96-44ef-8fea-9c797b112cbe',   3.0),  -- Philip Osakwe — no workbook match, floor
    ('3d0088c7-be59-48ef-8d93-e116f45ac8c3',   3.0),  -- Praise Bukem — Praise Bukem (RAP)
    ('aebe8b07-33c5-4179-b2d9-a55c6743f69a',  10.5),  -- Praise Miene — Praise Miene (IKN)
    ('9fd49630-1713-4ad4-aa7e-374e2ba4e196',   3.0),  -- Praise odebo — no workbook match, floor
    ('016151a6-21c1-4072-82ee-6b787051b728',   3.0),  -- Precious Apeh — no workbook match, floor
    ('4ed648f9-b166-410c-bcde-cb663fac02bf',   8.0),  -- Precious George — Precious George (GBK)
    ('5ca345c6-e2c0-4c22-a800-ccd601fcc379',   3.0),  -- Precious Maverick Chukuemeka — no workbook match, floor
    ('a586b9e6-075e-43ac-8eec-2d1ba673014d',   6.0),  -- Prisca Oguh — Prisca Oguh (BRV)
    ('add7b4d3-c5a5-4db3-9b25-a335b7922f1e',   3.0),  -- Promise Nicholas — Promise Nicholas (RAP)
    ('433b36ef-4e89-4f39-8d6e-714dd3343d7d',   5.0),  -- Quadri Odufuwa — Quadri Odufuwa (ALP)
    ('85c9ece2-5d1b-48e5-8fd8-d6151359b096',   3.0),  -- Qudus Odutola — no workbook match, floor
    ('ebd6ae51-7c10-4195-82ae-87bcf4d23a34',   6.5),  -- Qudus Tanimowo — Qudus Tanimowo (ALP)
    ('971cfeea-7557-466b-8ed4-9f265bca433c',   3.0),  -- Rachael Iliya — no workbook match, floor
    ('2be7301a-b83a-417c-b448-bd5f9b3b23c7',   5.5),  -- Raphael Adekunle — AdeKunle Raphael (REB)
    ('a095ad27-3654-420e-9db6-780c6ae1981d',   3.0),  -- Raphael James — no workbook match, floor
    ('06bb65a5-641a-4332-8492-f08f4f76f41d',   3.0),  -- Rasheed Adeyiga — no workbook match, floor
    ('f097708b-47c7-412a-a57f-d7fa6d889288',   3.0),  -- Rashidat Mukaila — no workbook match, floor
    ('b6ee24d5-a446-45ac-ad29-52cafc643483',   3.0),  -- Rex Ndukwu — no workbook match, floor
    ('82c33fbd-97b1-4991-8d0c-779142274bdc',   6.5),  -- Robert Edidiong — Robert Edidiong (ALP)
    ('5e7d58ba-dc65-4250-bc19-84235f5ae2e9',   3.0),  -- Rukayat Akinade — no workbook match, floor
    ('33de9582-9e42-4ef7-a504-e69ad5072329',  12.5),  -- Ruth Chilaka — Ruth Chilaka (REB)
    ('81053a2a-2493-4b85-8a18-4fc19839fad1',   3.0),  -- Ruth Effiong — no workbook match, floor
    ('b4ab0bc3-b95f-4faa-a0f9-51cc8b53eb6b',   3.0),  -- Salamatu Audu — no workbook match, floor
    ('e2493928-8219-4734-973e-2b83c7bfb289',   7.5),  -- Salimon Muhammed — Salimon Muhammed (IKN)
    ('4043772d-b1b6-4d46-85a8-69ac10a1c3ff',   3.0),  -- Salimon Muhammed Okikiola — no workbook match, floor
    ('d9f218a1-7426-45e0-a885-a95d6f0bd522',   3.0),  -- Sammeey Agulonu — no workbook match, floor
    ('39929f4c-3ab1-4992-b8f7-d281544c3373',   3.0),  -- Samuel Adejumo — no workbook match, floor
    ('56bd7351-788f-4aa4-a2c2-90603d6bab6a',  11.0),  -- Samuel Gbemisola — Samuel Gbemisola (WAR)
    ('0632a6d7-0afb-4006-b803-32d3497d2f8f',   3.0),  -- Samuel Kalejaiye — no workbook match, floor
    ('998e0560-9f57-4a5f-b54f-d017bd39e3b4',  11.0),  -- Samuelmoses Tega — Samuelmoses Tega (HNS)
    ('ba8c85c4-2a0b-4734-ab8f-d9fbe3eb5229',   3.0),  -- Sarah Amah — no workbook match, floor
    ('1b6dcef7-dfda-4c2e-9a39-3b06f6a4591e',   3.0),  -- Sayo Ak — no workbook match, floor
    ('b151455a-e2cc-44f3-a8ef-c4e6884fcc15',   3.0),  -- Segun Nanakumo — no workbook match, floor
    ('d672777a-39b5-447c-b096-3f2fff539256',   3.0),  -- Segun Obadina — no workbook match, floor
    ('ccc1afbb-e999-405d-997f-10df71885d36',   6.0),  -- Sharon Olagbami — Sharon Olagbami (IKN)
    ('bbb36de3-1c87-4caa-9338-95b8af1cff3f',   3.0),  -- Sharon Olagbemi — no workbook match, floor
    ('2080b569-54e0-4625-9e9c-271395998fdf',   3.0),  -- Sheriff Idris — Sheriff Idris (ALP)
    ('e0fb645f-f6da-4cc9-b577-e51696a90bf4',   3.0),  -- Shobande Ayomide Favour — no workbook match, floor
    ('c4884bae-bcfc-450d-a3f4-7936ea083f43',   4.0),  -- Silas Ighalomen — Silas Ighalomen (WAR)
    ('253bce81-4d69-4d5c-85b5-8c4cecf2541c',  10.5),  -- Sodiq Ayinde — Sodiq Ayinde (LAK)
    ('2247373b-ec1b-4cf8-8c54-99b9cca20e4d',   3.0),  -- Solomon Alonge — no workbook match, floor
    ('ce25e4f9-554f-469f-869e-37ebd4bc2e22',   3.0),  -- Solomon Patience — no workbook match, floor
    ('16a8e3ed-3141-4020-b5bd-e568baa1b5eb',   3.0),  -- Somkene Jipreze — no workbook match, floor
    ('908d84c2-576c-4d58-baf6-5cd0d75bd7d7',   3.0),  -- Sooj Osuji — no workbook match, floor
    ('8e68ba66-a1b5-45ec-9746-916ba86bbbf5',   3.0),  -- Sophia Chineye Onyegirigwam — no workbook match, floor
    ('cfd5d529-75f3-4e1d-aa56-c9291ae7cdde',   3.0),  -- Stanley Adindu — no workbook match, floor
    ('dd5b6eab-d4b5-47cb-8d60-f1e6f9b3fb08',   3.0),  -- Stephanie Chinaza — no workbook match, floor
    ('804ab2b0-f579-4f88-a08e-39d46b881847',   8.0),  -- Stephanie Onyegirigwam — Stephanie Onyegirigwam (REB)
    ('41cbf203-3be1-4a7f-b7e1-be8f18c406e4',   6.0),  -- Stephen Comfort — Stephen Comfort (RAP)
    ('6ae23b04-a850-441e-a2e8-58fcd8a7a8a3',   3.0),  -- Stephen Kiki — no workbook match, floor
    ('48b0862a-509e-4aec-9e00-1babed15f6fd',   3.0),  -- Subair Patience — no workbook match, floor
    ('891e1755-aded-4314-b31e-c544397bb6aa',  10.5),  -- Success Patrick — Success Patrick (WAR)
    ('843aa5ba-d46d-4361-a1ad-5510723b5605',   3.0),  -- Sulaimon Adebara — no workbook match, floor
    ('bec97d05-b762-4c02-a8b7-1feb69d4c36a',  11.5),  -- Sulaimon Alhameen — Sulaimon Alhameen (REB)
    ('b7b52969-b25e-46c6-a85f-3e621e68bee5',   3.0),  -- Sulaimon Babayo — no workbook match, floor
    ('45125b7d-6a41-4671-b543-05a525f7552d',   3.0),  -- Sulaimon Fashogbon — no workbook match, floor
    ('a49210b2-2838-44f3-a3a6-b8bd5f663fb1',   3.0),  -- Sulaimon Olatunde — no workbook match, floor
    ('4057652a-d175-4de3-bf51-f5f50b1573ed',   3.0),  -- Sunday Oke — no workbook match, floor
    ('7b13bbb4-cf9e-4ee6-87a7-a9c1d6e9d9fd',   3.0),  -- Sunmisola Okeyemi — no workbook match, floor
    ('2f899b55-f44d-40b2-a243-7045dc20f7ec',   3.0),  -- Sunmisola Okeyemi — no workbook match, floor
    ('4d88320e-ba23-4cb7-9fc1-9afc2b1a62ce',   3.0),  -- Surprise Babalola — no workbook match, floor
    ('65dc33bf-002d-4769-8b71-de368076c4cb',   3.0),  -- Sylvia Nwoko — no workbook match, floor
    ('8d4665bd-372f-498f-80b1-02f6c8ebcf0d',   3.0),  -- Taiwo Adebole — no workbook match, floor
    ('91662827-aacb-4046-aa2e-e987b3ae974c',   6.0),  -- Taiwo Adebolu — Taiwo Adebolu (PAN)
    ('f7c9fd18-67ad-4216-ac27-69a70a55a931',   7.5),  -- Taiwo Badmus — Taiwo Badmus (LAK)
    ('6a755451-c237-44a5-b62f-3c1f799f41f8',   3.0),  -- Taiwo Egunjobi — no workbook match, floor
    ('19bfb947-eb8c-4ef1-a6a0-42c2cdca106b',  12.0),  -- Taiwo Oluwalanu — Taiwo Oluwalanu (RAP)
    ('947f4ed0-c64f-460c-9076-57848ca99585',   3.0),  -- Taiwo Oluwashindara — Taiwo Oluwashindara (GBK)
    ('923c82b2-75ec-4473-bd66-b159fdcf7867',   3.0),  -- Takim Agbor — Takim Agbor (REB)
    ('7e1b2f75-642b-4a9c-baf3-8f3edd29fce5',   3.0),  -- Taniwo Qudus — no workbook match, floor
    ('bac40315-1058-4c51-80e9-82a1bc828356',   3.0),  -- Temi Adeola — no workbook match, floor
    ('e1c0fe70-3e4e-4c79-9133-bbee88dcc62c',   3.0),  -- Temi Adesola — no workbook match, floor
    ('a1781d66-4ba3-4180-9628-932e4729059d',   3.0),  -- Temi Adesola — no workbook match, floor
    ('b10db999-7750-4eb0-aaab-4e7025c57428',   3.0),  -- Temi Diabo — no workbook match, floor
    ('ae50d4ad-3534-4933-9495-a59e23a2824d',   3.0),  -- Temidoyo Kpere-Daibo — no workbook match, floor
    ('1ed35d40-0463-4675-8ad3-1e6fa1f2ecf8',   3.0),  -- Temilade Fafore — no workbook match, floor
    ('dfa7332f-f691-46ad-a808-1a167032bacd',   5.5),  -- Temituro Elizabeth — Temituro Elizabeth (ALP)
    ('69453a1c-3bf7-4c28-8698-48eb8e5fb2f8',   3.0),  -- Testimony Oluwajimi — no workbook match, floor
    ('24309e51-58a4-44ef-9c0c-a3525c6f3002',   3.0),  -- Theodora Amadi-Ikwechegh — no workbook match, floor
    ('b7e27e49-0fe0-4732-8984-11e25e6e67d4',   3.0),  -- Theresa Mac-Dangosu — no workbook match, floor
    ('4f91e8f9-20a3-4c47-b87e-3ddabc6d1c0a',   5.5),  -- Thompson Daniel — Thompson Daniel (WAR)
    ('e6843220-c479-4f64-a41c-2747b716318d',   3.0),  -- Timilehin Emmanuel — no workbook match, floor
    ('0cbdb12e-8bdf-43cb-bc78-341fbd4aa319',   3.0),  -- Timilehin Okunowo — no workbook match, floor
    ('d42e1f3f-a881-476a-b57c-fccb378ab930',   3.0),  -- Timilehin Osho — no workbook match, floor
    ('dd222a94-722c-4ac7-91b3-0d79b73adb78',  11.0),  -- Timothy Atibile — Timothy Atibile (IKN)
    ('0c5b45cc-6a81-47a0-b28e-058ae38413bf',   3.0),  -- Timothy Israel — no workbook match, floor
    ('bece69f2-d652-4e11-af92-7fa9c16128f8',   3.0),  -- Tina Oluwabukola — no workbook match, floor
    ('f2bcec69-69fd-4802-b0da-2377621ca08b',   3.0),  -- Titilayo Abanikanda — no workbook match, floor
    ('38bb1220-430a-430a-92d1-b773f769ded5',   3.0),  -- Tobi Fasasi — no workbook match, floor
    ('cc977b7c-2dc5-4d01-87b4-69c4317f4580',   3.0),  -- Tobiloba Ekundayo — no workbook match, floor
    ('de3141c4-2f4d-4f15-adf2-09ccdc749245',   3.0),  -- Tochukwu Ndukwu — no workbook match, floor
    ('6ac2f4ab-0c78-4a2b-b790-e66f21131faf',   3.0),  -- Tokunbo Ilupeju — no workbook match, floor
    ('7f417067-0473-42b0-acb6-a559f1e46c07',   3.0),  -- Tolu Talabi — no workbook match, floor
    ('c69eb712-285e-4e1d-9b28-a0a1e985d4b9',   4.5),  -- Toluwalase Kujore-Onifade — Toluwalase Kujore-Onifade (IKN)
    ('a032b2ba-bfb9-4049-9138-65550acee20b',   3.0),  -- Tom Ezekiel — no workbook match, floor
    ('155c90d6-3f1c-4be5-8471-c17888e072ce',   3.0),  -- Tomisin Numbere — no workbook match, floor
    ('3e9169c3-d18d-4a02-b4e5-0e145b72c174',   3.0),  -- Tomiwa Macaulay — no workbook match, floor
    ('893c8ae9-c2b6-4bf9-a7cd-96b4dbc568c9',   3.0),  -- Tosin Emily Oyeleye — no workbook match, floor
    ('d8ae7dbf-3257-4749-8971-b97d92f60324',   9.0),  -- Toyibat Samsondeen — Toyibat Samsondeen (RAP)
    ('80d267dc-139e-4ad8-8b22-bcd5ed9cd2b1',   5.5),  -- Travis Akinwunmi — Travis Akinwunmi (ALP)
    ('5dda7c48-d9b9-4255-8181-fce12a760a07',   3.0),  -- Tunde Adeola — no workbook match, floor
    ('b4492930-dcd0-4f83-8606-8d8cabeea51f',   3.0),  -- Tunde Owolabi — no workbook match, floor
    ('8948045e-91e9-4089-ab80-88c85fd64cb0',   3.0),  -- Uba Emole — no workbook match, floor
    ('c1483061-0da3-410e-ad8a-f2cba7876e2c',   3.0),  -- Ubana Isaac — no workbook match, floor
    ('a5f331d3-6abd-4ef7-994b-67b3c2db138d',   3.0),  -- Uche Jerz — no workbook match, floor
    ('1dbfea70-c9a0-4bf0-a82f-8ee4570f2234',  11.5),  -- Uchenna Henry — Uchenna Henry (REB)
    ('5acd82b3-bf38-4f90-8e22-b13bb81755e7',   3.0),  -- Udochukwu Uzuegbu — no workbook match, floor
    ('01132b95-7b3b-4975-a70c-e7af1db714a3',   3.0),  -- Ugboma Obi Michael — no workbook match, floor
    ('5cd0a768-a271-44fa-8695-4c071c0fabd7',   3.0),  -- Ugochi 66 — no workbook match, floor
    ('534acf04-675d-45d3-8884-24c9564807ce',   3.0),  -- Ugochukwu Okeke — no workbook match, floor
    ('65d09b2a-b9f4-4c76-838d-06616cdde001',   3.0),  -- Ugochukwu Uchella — no workbook match, floor
    ('3994b0c9-ee63-4713-ac45-773e399dc634',   7.0),  -- Ulrich Johannes — Johannes Ulrich (BRV)
    ('4d14b49d-97d0-4f8c-80c4-e5ad07012129',   5.5),  -- Umeh Chisom — Umeh Chisom (GBK)
    ('18c15ce5-fba4-422f-afae-627171692b89',   3.0),  -- Umeri Ruth Eberechukwu — no workbook match, floor
    ('5c1c4e26-2ed0-44bb-9f50-9e36d9ae7c82',   3.0),  -- Utibe Arthur — no workbook match, floor
    ('1fa166ad-e3d6-4c52-b678-fe1accdf2aaa',   7.0),  -- Utibe Ayi — Utibe Ayi (IKN)
    ('f5c4fa75-c796-4b09-b743-91d325aa0c9a',   3.0),  -- Utibe Udo Effiong — Utibe Udo Effiong (ALP)
    ('3f0a958f-4f7a-4b9e-8552-91fcbe2bbfdb',   4.0),  -- Uwaje Emmanuel — Uwaje Emmanuel (HNS)
    ('5a131cce-bb87-4d14-9bbe-c4a96c0b8ac5',   3.0),  -- Uwaje Emmanuel Ndubuisi — no workbook match, floor
    ('fd774662-dac3-4251-a3a6-6fb5c73fa99e',   7.0),  -- Valentina Anieloka — Anieloka Valentina (PAN)
    ('9bd7f38f-62cd-4aea-a1cc-86786a838ecd',   3.0),  -- Victor Atisele — no workbook match, floor
    ('1c0011b5-fde8-46ee-843d-b64081578ae2',   3.0),  -- Victor Linus — no workbook match, floor
    ('acc5dc91-cc31-47c7-8714-7eb4ee8d458a',   3.0),  -- Victoria Clement — no workbook match, floor
    ('daa3aec7-db57-4b63-9ed2-84277c53d552',   3.0),  -- Waji Simeon — no workbook match, floor
    ('3082af78-4760-4efd-8753-e4483bfcf494',   4.0),  -- Wale Quadri — Wale Quadri (ALP)
    ('9d0a7d26-dd18-4e0f-857a-7dfe0d615cc7',   7.5),  -- Waliyat Lawal — Waliyat Lawal (IKN)
    ('ebac62a2-5c10-44ec-ba1c-4fdc3fe2be4b',   3.0),  -- Whaton Shedrack Jamelo — no workbook match, floor
    ('eecc5619-e285-4ecc-bc8e-2c93b9c20d44',   3.0),  -- Whyte Oghene — no workbook match, floor
    ('27fd9526-340b-48d5-a26d-1428d35b241f',  11.0),  -- Williams Oluwatosin — Williams Oluwatosin (HNS)
    ('a46a0ccc-d505-4346-a23f-2bedecfe9cb3',   3.0),  -- Wilson Christopher — no workbook match, floor
    ('d6978366-968b-48f8-9d53-af07d156f603',   3.5),  -- Wilson Mazi — Wilson Mazi (ALP)
    ('eacb6e8c-92b1-4bde-8cec-bebd4a2562e9',   3.0),  -- Winner Peter — no workbook match, floor
    ('743bb35a-1788-440f-a6ca-73b9ee6cf415',   3.0),  -- Wisdom Omatule — no workbook match, floor
    ('bc207808-fa07-49e4-a585-48a47b15ffa6',   5.5),  -- Yesirah Sulaimon — Yesirah Sulaimon (RAP)
    ('db37a535-c914-4b2e-a17f-dce9a1e762f4',   5.5),  -- Yinoluwa Olowofoyeku — Yinoluwa Olowofoyeku (PAN)
    ('51c4f723-f775-4ee6-9b4f-6c06f79aa27a',   3.0),  -- Youseff Olopoeniyan — no workbook match, floor
    ('459afe52-1f84-46dd-9952-65e38c274970',  11.0),  -- Yusuf Adams — Yusuf Adams (RAP)
    ('f0431169-9576-4383-92b1-d846ff57f122',   3.0),  -- Yusuf Akeem — no workbook match, floor
    ('746f7a87-6fae-42f1-bf89-c3c5011ff87e',   8.0),  -- Yusuf Olopoeniyan — Yusuf Olopoeniyan (ALP)
    ('0e35e4ec-8425-479d-bd55-7a3058374624',   3.0),  -- Yusuf Opeyemi — no workbook match, floor
    ('a3d19f43-17b3-4504-8f54-66c43770dda6',   3.0),  -- Yusuf Oyegunle — no workbook match, floor
    ('f208ff4e-4375-425d-bef4-d91aaa6075ea',   3.0),  -- Zahariya Kabiru — no workbook match, floor
    ('0855dc2f-6b99-4287-9dd5-7792842116e3',   3.0),  -- Zakari Ojochegbe — Zakari Ojochegbe (PAN)
    ('4f61a0ee-f9fc-42a0-a5f7-9f2a4ed38c9b',   3.0),  -- Zubby Ifeanyi — no workbook match, floor
    ('e1cb1f9c-c6f4-4bca-aa4e-6434e9b57e42',   3.0),  -- aero ayogu — no workbook match, floor
    ('4eb960fc-2bba-418d-899c-0a1fb33055c9',   3.0),  -- akinkunmi akande — no workbook match, floor
    ('f5601079-2d5c-40f1-8f8a-72bc6aac8112',   3.0),  -- blessing miebarca — no workbook match, floor
    ('9fcd499c-0733-4edb-813f-dade1230556f',   3.0),  -- chibuzor onyegu — no workbook match, floor
    ('fbc7d591-0f8b-4556-8892-3c5d89276ca6',   3.0),  -- chukwuemeka alagwu — no workbook match, floor
    ('9fdc50f5-7174-4450-b1f9-65f59e3d7445',   3.0),  -- clinton olafisoye — no workbook match, floor
    ('fa5a83b4-1b06-4e32-b646-23f1f839ea74',   3.0),  -- daniel samuel — daniel samuel (ALP)
    ('722f5140-2648-4f83-bc64-cbd7da2a9e37',   3.0),  -- david john — no workbook match, floor
    ('57d5f810-d3c3-4d68-95ff-b984f9baee75',   3.0),  -- deborah olasoji — no workbook match, floor
    ('241d64e6-cecb-4bba-945a-79b0b3f10d4f',   3.0),  -- feyi adekogbea — no workbook match, floor
    ('5777535a-6b11-4cea-ba99-f876163907f6',   3.0),  -- jolade adeoye — no workbook match, floor
    ('a15a7ed1-065c-401e-bae3-611e9d36b332',   3.0),  -- joshua ogbonna — no workbook match, floor
    ('4140a68c-dedc-4938-85c0-a70939bd4a46',   3.0),  -- lydia yusuf — no workbook match, floor
    ('1c7ef060-8a4f-47fa-8c66-de808ae8d6e6',   3.0),  -- michael sejebor — Sejebor Michael (IKN)
    ('cca2cfe8-8ebf-46da-8314-32d52c4a9ed0',   3.0)  -- precious abiodun — no workbook match, floor
) AS v(player_id, price)
ON CONFLICT (season_id, player_id) WHERE gameweek_id IS NULL
DO UPDATE SET price = EXCLUDED.price, base_price = EXCLUDED.base_price, created_at = NOW();

-- Check afterwards:
--   SELECT COUNT(*), MIN(price), ROUND(AVG(price),2), MAX(price)
--   FROM fantasy_player_prices
--   WHERE season_id = '22a076a8-91d1-4189-921e-12d1b89acccb' AND gameweek_id IS NULL;
