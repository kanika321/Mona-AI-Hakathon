import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";

/* =============================================================
   NIGHTINGALE v2 — Shift-cover dispatcher for UKS Homburg
   Message it when a shift opens. It applies the real eligibility
   rules from the hospital schedule (role + certs, off tonight,
   rested, under weekly cap, active), ranks by the file's
   tie-breakers, and reaches out until the shift is covered.
   Roster is embedded; upload an .xlsx to refresh it.
   (Outreach itself is simulated in this prototype.)
   ============================================================= */

const GEMINI_KEY = "";
const MODEL = "gemini-2.5-flash-lite";
const TODAY = "2026-06-20";
const WEEK_LABELS = ["Fri 06/19", "Sat 06/20", "Sun 06/21", "Mon 06/22", "Tue 06/23", "Wed 06/24", "Thu 06/25", "Fri 06/26"];

const STAFF = [{"id":"HOSP-1001","first":"Isla","last":"Nguyen","role":"Registered Nurse","dept":"Cardiology","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":false,"status":"Active","persona":"Open to last-minute cover","lastOut":"— on shift —","phone":"+49 151 130 2535","week":["D","D","O","O","O","D","D","O"],"schedHrs":36},{"id":"HOSP-1002","first":"Tariq","last":"Bianchi","role":"Certified Nursing Assistant","dept":"General Medicine","certs":["BLS"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":false,"status":"Active","persona":"Commutes far, dislikes back-to-backs","lastOut":"2026-06-17 19:00:00","phone":"+49 168 384 1106","week":["O","N","O","O","D","O","O","D"],"schedHrs":36},{"id":"HOSP-1003","first":"Hannah","last":"Reyes","role":"Registered Nurse","dept":"Maternity","certs":["BLS","NRP"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":true,"status":"Active","persona":"Has young children, prefers day shifts","lastOut":"2026-06-16 19:00:00","phone":"+49 161 967 6635","week":["O","O","D","O","O","O","D","N"],"schedHrs":36},{"id":"HOSP-1004","first":"Hassan","last":"Novak","role":"Certified Nursing Assistant","dept":"Emergency","certs":["BLS"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":true,"status":"Active","persona":"Calm under pressure in codes","lastOut":"2026-06-18 19:00:00","phone":"+49 168 296 2139","week":["O","N","N","N","O","O","O","O"],"schedHrs":36},{"id":"HOSP-1005","first":"Ethan","last":"Wagner","role":"Physician","dept":"Surgery","certs":["BLS","ACLS"],"contract":"Per-diem","maxHrs":36,"pref":"Flexible","ot":false,"status":"Active","persona":"Commutes far, dislikes back-to-backs","lastOut":"— on shift —","phone":"+49 170 954 6977","week":["O","D","O","N","O","O","N","O"],"schedHrs":36},{"id":"HOSP-1006","first":"Hannah","last":"Kim","role":"Registered Nurse","dept":"Oncology","certs":["BLS","OCN"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":false,"status":"Active","persona":"Working toward charge-nurse role","lastOut":"2026-06-19 19:00:00","phone":"+49 167 846 5010","week":["D","O","O","D","D","N","O","O"],"schedHrs":36},{"id":"HOSP-1007","first":"Hannah","last":"Lindgren","role":"Registered Nurse","dept":"Maternity","certs":["BLS","NRP"],"contract":"Per-diem","maxHrs":36,"pref":"Night","ot":true,"status":"Active","persona":"Senior staff, mentors new grads","lastOut":"2026-06-19 07:00:00","phone":"+49 157 941 1525","week":["O","N","O","N","O","N","O","N"],"schedHrs":48},{"id":"HOSP-1008","first":"Sara","last":"Weber","role":"Registered Nurse","dept":"Cardiology","certs":["BLS","ACLS"],"contract":"Per-diem","maxHrs":36,"pref":"Night","ot":false,"status":"Active","persona":"Union rep, watches hours closely","lastOut":"2026-06-17 07:00:00","phone":"+49 162 758 8517","week":["O","O","O","O","N","O","N","O"],"schedHrs":24},{"id":"HOSP-1009","first":"Nora","last":"Novak","role":"Registered Nurse","dept":"Pediatrics","certs":["BLS","PALS"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":false,"status":"Active","persona":"Prefers predictable schedules","lastOut":"2026-06-19 19:00:00","phone":"+49 161 324 3266","week":["D","O","D","D","D","O","O","O"],"schedHrs":36},{"id":"HOSP-1010","first":"Caleb","last":"Marino","role":"Certified Nursing Assistant","dept":"ICU","certs":["BLS"],"contract":"Per-diem","maxHrs":36,"pref":"Day","ot":true,"status":"Active","persona":"New grad, still onboarding","lastOut":"— on shift —","phone":"+49 162 490 8668","week":["D","D","D","O","D","O","O","O"],"schedHrs":36},{"id":"HOSP-1011","first":"Reza","last":"Novak","role":"Physician","dept":"General Medicine","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":false,"status":"Active","persona":"Avoids overtime when possible","lastOut":"2026-06-19 19:00:00","phone":"+49 174 756 6573","week":["D","O","O","D","N","O","O","O"],"schedHrs":24},{"id":"HOSP-1012","first":"Isla","last":"Petrov","role":"Registered Nurse","dept":"Maternity","certs":["BLS","NRP"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":false,"status":"On Leave","persona":"Working toward charge-nurse role","lastOut":"2026-06-17 19:00:00","phone":"+49 166 208 5889","week":["O","O","O","O","O","O","O","O"],"schedHrs":0},{"id":"HOSP-1013","first":"Dunia","last":"Esposito","role":"Registered Nurse","dept":"Surgery","certs":["BLS","ACLS"],"contract":"Part-time","maxHrs":30,"pref":"Night","ot":false,"status":"Active","persona":"Reliable, frequently picks up extra shifts","lastOut":"2026-06-18 07:00:00","phone":"+49 169 431 9005","week":["O","N","O","N","O","N","N","O"],"schedHrs":48},{"id":"HOSP-1014","first":"Sofia","last":"Müller","role":"Physician","dept":"Oncology","certs":["BLS","ACLS"],"contract":"Part-time","maxHrs":30,"pref":"Day","ot":true,"status":"Active","persona":"New grad, still onboarding","lastOut":"— on shift —","phone":"+49 152 849 8962","week":["O","D","O","O","O","O","O","O"],"schedHrs":12},{"id":"HOSP-1015","first":"Emma","last":"Holm","role":"Physician","dept":"General Medicine","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Night","ot":true,"status":"Active","persona":"Open to last-minute cover","lastOut":"2026-06-17 07:00:00","phone":"+49 156 652 4295","week":["O","O","N","O","O","N","N","O"],"schedHrs":36},{"id":"HOSP-1016","first":"Niko","last":"Weber","role":"Registered Nurse","dept":"Oncology","certs":["BLS","OCN"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":true,"status":"Active","persona":"Quiet, dependable, rarely calls out","lastOut":"— on shift —","phone":"+49 157 702 4608","week":["D","D","D","O","O","D","D","O"],"schedHrs":48},{"id":"HOSP-1017","first":"Aisha","last":"Hernandez","role":"Registered Nurse","dept":"Emergency","certs":["BLS","ACLS","TNCC"],"contract":"Per-diem","maxHrs":36,"pref":"Flexible","ot":true,"status":"Active","persona":"Union rep, watches hours closely","lastOut":"— on shift —","phone":"+49 156 652 3167","week":["O","D","N","N","N","O","O","O"],"schedHrs":48},{"id":"HOSP-1018","first":"Samir","last":"Vasquez","role":"Radiologic Technologist","dept":"Radiology","certs":["ARRT"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":true,"status":"Active","persona":"Calm under pressure in codes","lastOut":"2026-06-16 19:00:00","phone":"+49 163 520 8651","week":["O","O","D","D","D","O","O","D"],"schedHrs":48},{"id":"HOSP-1019","first":"Zara","last":"Dlamini","role":"Registered Nurse","dept":"ICU","certs":["BLS","ACLS"],"contract":"Part-time","maxHrs":30,"pref":"Flexible","ot":true,"status":"Active","persona":"Quiet, dependable, rarely calls out","lastOut":"2026-06-18 19:00:00","phone":"+49 164 243 7912","week":["O","O","O","O","O","O","O","D"],"schedHrs":12},{"id":"HOSP-1020","first":"Marco","last":"Costa","role":"Radiologic Technologist","dept":"Radiology","certs":["ARRT"],"contract":"Per-diem","maxHrs":36,"pref":"Night","ot":false,"status":"Active","persona":"Senior staff, mentors new grads","lastOut":"2026-06-20 07:00:00","phone":"+49 170 653 1241","week":["N","O","N","N","N","O","O","O"],"schedHrs":36},{"id":"HOSP-1021","first":"Mateo","last":"Holm","role":"Registered Nurse","dept":"Surgery","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":true,"status":"Active","persona":"Prefers predictable schedules","lastOut":"— on shift —","phone":"+49 150 499 5345","week":["D","D","D","D","O","D","O","O"],"schedHrs":48},{"id":"HOSP-1022","first":"Greta","last":"Petrov","role":"Certified Nursing Assistant","dept":"Maternity","certs":["BLS"],"contract":"Part-time","maxHrs":30,"pref":"Flexible","ot":false,"status":"Active","persona":"Part-time by choice, studying part-time","lastOut":"2026-06-19 19:00:00","phone":"+49 159 322 1958","week":["D","O","O","O","D","N","O","O"],"schedHrs":24},{"id":"HOSP-1023","first":"Nina","last":"Sørensen","role":"Registered Nurse","dept":"General Medicine","certs":["BLS"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":true,"status":"Active","persona":"Cross-trained on two units","lastOut":"2026-06-18 19:00:00","phone":"+49 155 158 9320","week":["O","O","O","D","D","D","D","O"],"schedHrs":48},{"id":"HOSP-1024","first":"Olivia","last":"Dubois","role":"Certified Nursing Assistant","dept":"ICU","certs":["BLS"],"contract":"Part-time","maxHrs":30,"pref":"Day","ot":true,"status":"Active","persona":"Float-pool veteran, flexible across units","lastOut":"2026-06-16 19:00:00","phone":"+49 168 708 1651","week":["O","O","O","D","O","D","O","O"],"schedHrs":24},{"id":"HOSP-1025","first":"Emil","last":"Kowalski","role":"Certified Nursing Assistant","dept":"Maternity","certs":["BLS"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":true,"status":"Active","persona":"Per-diem, very flexible","lastOut":"— on shift —","phone":"+49 157 371 7484","week":["D","D","D","D","D","O","O","O"],"schedHrs":48},{"id":"HOSP-1026","first":"Layla","last":"Wagner","role":"Registered Nurse","dept":"Cardiology","certs":["BLS","ACLS"],"contract":"Per-diem","maxHrs":36,"pref":"Flexible","ot":true,"status":"Active","persona":"Has young children, prefers day shifts","lastOut":"— on shift —","phone":"+49 152 650 4492","week":["O","D","O","D","D","D","O","O"],"schedHrs":48},{"id":"HOSP-1027","first":"Dunia","last":"Novak","role":"Nurse Practitioner","dept":"Pediatrics","certs":["BLS","PALS"],"contract":"Per-diem","maxHrs":36,"pref":"Flexible","ot":true,"status":"Active","persona":"Quiet, dependable, rarely calls out","lastOut":"2026-06-16 19:00:00","phone":"+49 172 409 9666","week":["O","O","O","N","O","O","O","O"],"schedHrs":12},{"id":"HOSP-1028","first":"Liam","last":"Wagner","role":"Registered Nurse","dept":"General Medicine","certs":["BLS"],"contract":"Part-time","maxHrs":30,"pref":"Flexible","ot":true,"status":"Active","persona":"Has young children, prefers day shifts","lastOut":"2026-06-17 19:00:00","phone":"+49 173 666 3546","week":["O","O","O","N","O","O","O","O"],"schedHrs":12},{"id":"HOSP-1029","first":"Freya","last":"Petrov","role":"Pharmacist","dept":"Pharmacy","certs":["PharmD"],"contract":"Full-time","maxHrs":48,"pref":"Night","ot":false,"status":"Active","persona":"Avoids overtime when possible","lastOut":"2026-06-18 07:00:00","phone":"+49 178 966 1832","week":["O","N","N","O","N","N","N","O"],"schedHrs":60},{"id":"HOSP-1030","first":"Mateo","last":"Janssen","role":"Physician","dept":"Maternity","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":true,"status":"On Leave","persona":"Working toward charge-nurse role","lastOut":"2026-06-16 19:00:00","phone":"+49 173 552 8007","week":["O","O","O","O","O","O","O","O"],"schedHrs":0},{"id":"HOSP-1031","first":"Otto","last":"Okafor","role":"Registered Nurse","dept":"ICU","certs":["BLS","ACLS"],"contract":"Per-diem","maxHrs":36,"pref":"Flexible","ot":true,"status":"Active","persona":"Quiet, dependable, rarely calls out","lastOut":"2026-06-17 19:00:00","phone":"+49 154 540 3088","week":["O","O","N","O","O","O","O","D"],"schedHrs":24},{"id":"HOSP-1032","first":"Ethan","last":"Schmidt","role":"Nurse Practitioner","dept":"Oncology","certs":["BLS","OCN"],"contract":"Part-time","maxHrs":30,"pref":"Flexible","ot":false,"status":"Active","persona":"Float-pool veteran, flexible across units","lastOut":"2026-06-20 07:00:00","phone":"+49 171 205 6794","week":["N","O","O","O","O","O","O","D"],"schedHrs":12},{"id":"HOSP-1033","first":"Otto","last":"Romano","role":"Pharmacy Technician","dept":"Pharmacy","certs":["CPhT"],"contract":"Per-diem","maxHrs":36,"pref":"Day","ot":true,"status":"Active","persona":"Working toward charge-nurse role","lastOut":"2026-06-19 19:00:00","phone":"+49 178 522 1406","week":["D","O","O","O","O","D","O","D"],"schedHrs":24},{"id":"HOSP-1034","first":"Elena","last":"Sørensen","role":"Physician","dept":"Oncology","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Night","ot":false,"status":"Active","persona":"Working toward charge-nurse role","lastOut":"2026-06-19 07:00:00","phone":"+49 175 818 2771","week":["O","O","N","O","N","N","O","N"],"schedHrs":48},{"id":"HOSP-1035","first":"Lucia","last":"Rossi","role":"Radiologic Technologist","dept":"Radiology","certs":["ARRT"],"contract":"Part-time","maxHrs":30,"pref":"Night","ot":true,"status":"Active","persona":"Float-pool veteran, flexible across units","lastOut":"2026-06-20 07:00:00","phone":"+49 157 124 4164","week":["N","O","O","O","N","N","O","O"],"schedHrs":24},{"id":"HOSP-1036","first":"Bruno","last":"Ivanov","role":"Physician","dept":"Cardiology","certs":["BLS","ACLS"],"contract":"Per-diem","maxHrs":36,"pref":"Day","ot":false,"status":"Active","persona":"Quiet, dependable, rarely calls out","lastOut":"2026-06-19 19:00:00","phone":"+49 160 128 2889","week":["D","O","O","D","O","D","O","O"],"schedHrs":24},{"id":"HOSP-1037","first":"Jonas","last":"Dubois","role":"Pharmacy Technician","dept":"Pharmacy","certs":["CPhT"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":true,"status":"Active","persona":"Per-diem, very flexible","lastOut":"— on shift —","phone":"+49 163 720 9379","week":["D","D","O","O","O","O","D","O"],"schedHrs":24},{"id":"HOSP-1038","first":"Isla","last":"Adeyemi","role":"Pharmacist","dept":"Pharmacy","certs":["PharmD"],"contract":"Full-time","maxHrs":48,"pref":"Night","ot":true,"status":"Active","persona":"Part-time by choice, studying part-time","lastOut":"2026-06-18 07:00:00","phone":"+49 161 541 2146","week":["O","N","N","O","N","O","N","O"],"schedHrs":48},{"id":"HOSP-1039","first":"Ines","last":"Khan","role":"Certified Nursing Assistant","dept":"Oncology","certs":["BLS"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":true,"status":"Active","persona":"Per-diem, very flexible","lastOut":"2026-06-20 07:00:00","phone":"+49 162 813 5844","week":["N","O","D","O","O","O","O","D"],"schedHrs":24},{"id":"HOSP-1040","first":"Wren","last":"Silva","role":"Registered Nurse","dept":"Surgery","certs":["BLS","ACLS"],"contract":"Per-diem","maxHrs":36,"pref":"Night","ot":false,"status":"Active","persona":"Recently returned from parental leave","lastOut":"2026-06-17 07:00:00","phone":"+49 162 661 1006","week":["O","O","O","N","N","N","O","N"],"schedHrs":48},{"id":"HOSP-1041","first":"Amara","last":"Petrov","role":"Registered Nurse","dept":"Surgery","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Night","ot":true,"status":"Active","persona":"Part-time by choice, studying part-time","lastOut":"2026-06-20 07:00:00","phone":"+49 166 584 3780","week":["N","N","O","N","O","N","O","O"],"schedHrs":36},{"id":"HOSP-1042","first":"Olivia","last":"Petrov","role":"Certified Nursing Assistant","dept":"General Medicine","certs":["BLS"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":false,"status":"Active","persona":"Recently returned from parental leave","lastOut":"— on shift —","phone":"+49 157 925 4262","week":["O","D","O","O","O","D","D","O"],"schedHrs":36},{"id":"HOSP-1043","first":"Nora","last":"Nguyen","role":"Registered Nurse","dept":"Emergency","certs":["BLS","ACLS","TNCC"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":true,"status":"Active","persona":"Part-time by choice, studying part-time","lastOut":"2026-06-18 19:00:00","phone":"+49 172 813 7291","week":["O","O","O","N","N","O","O","D"],"schedHrs":36},{"id":"HOSP-1044","first":"Pavel","last":"Weber","role":"Registered Nurse","dept":"Surgery","certs":["BLS","ACLS"],"contract":"Part-time","maxHrs":30,"pref":"Flexible","ot":false,"status":"Active","persona":"Open to last-minute cover","lastOut":"— on shift —","phone":"+49 157 280 9486","week":["D","D","O","D","O","O","O","N"],"schedHrs":36},{"id":"HOSP-1045","first":"Malik","last":"Patel","role":"Registered Nurse","dept":"General Medicine","certs":["BLS"],"contract":"Part-time","maxHrs":30,"pref":"Night","ot":false,"status":"Active","persona":"Quiet, dependable, rarely calls out","lastOut":"2026-06-19 07:00:00","phone":"+49 169 424 8251","week":["O","N","O","N","N","O","O","O"],"schedHrs":36},{"id":"HOSP-1046","first":"Lara","last":"Kovač","role":"Registered Nurse","dept":"General Medicine","certs":["BLS"],"contract":"Per-diem","maxHrs":36,"pref":"Night","ot":true,"status":"Active","persona":"Commutes far, dislikes back-to-backs","lastOut":"2026-06-19 07:00:00","phone":"+49 158 869 5050","week":["O","N","N","O","O","N","O","N"],"schedHrs":48},{"id":"HOSP-1047","first":"Ravi","last":"Antov","role":"Registered Nurse","dept":"General Medicine","certs":["BLS"],"contract":"Full-time","maxHrs":48,"pref":"Night","ot":false,"status":"Active","persona":"Per-diem, very flexible","lastOut":"2026-06-20 07:00:00","phone":"+49 160 653 2320","week":["N","N","N","O","O","O","O","N"],"schedHrs":36},{"id":"HOSP-1048","first":"Finn","last":"Larsson","role":"Registered Nurse","dept":"Surgery","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":true,"status":"Active","persona":"Commutes far, dislikes back-to-backs","lastOut":"— on shift —","phone":"+49 163 163 4388","week":["D","D","D","D","O","O","D","O"],"schedHrs":48},{"id":"HOSP-1049","first":"Aaron","last":"Adeyemi","role":"Pharmacy Technician","dept":"Pharmacy","certs":["CPhT"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":false,"status":"Active","persona":"Calm under pressure in codes","lastOut":"2026-06-17 19:00:00","phone":"+49 159 871 7389","week":["O","O","D","O","D","O","N","O"],"schedHrs":36},{"id":"HOSP-1050","first":"Aaron","last":"Park","role":"Physician","dept":"General Medicine","certs":["BLS","ACLS"],"contract":"Per-diem","maxHrs":36,"pref":"Night","ot":true,"status":"Active","persona":"Prefers predictable schedules","lastOut":"2026-06-18 07:00:00","phone":"+49 160 784 7624","week":["O","N","O","O","O","O","N","O"],"schedHrs":24},{"id":"HOSP-1051","first":"Kai","last":"Lindgren","role":"Respiratory Therapist","dept":"Pediatrics","certs":["BLS","ACLS","RRT"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":false,"status":"Active","persona":"New grad, still onboarding","lastOut":"2026-06-20 07:00:00","phone":"+49 170 538 3223","week":["N","O","D","D","D","O","O","D"],"schedHrs":48},{"id":"HOSP-1052","first":"Malik","last":"Dubois","role":"Registered Nurse","dept":"Emergency","certs":["BLS","ACLS","TNCC"],"contract":"Full-time","maxHrs":48,"pref":"Night","ot":true,"status":"Active","persona":"Avoids overtime when possible","lastOut":"2026-06-20 07:00:00","phone":"+49 174 951 7906","week":["N","N","O","O","O","O","O","N"],"schedHrs":24},{"id":"HOSP-1053","first":"Anya","last":"Kowalski","role":"Radiologic Technologist","dept":"Radiology","certs":["ARRT"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":true,"status":"Active","persona":"Senior staff, mentors new grads","lastOut":"2026-06-20 07:00:00","phone":"+49 174 131 5051","week":["N","O","D","O","N","O","O","O"],"schedHrs":24},{"id":"HOSP-1054","first":"Sam","last":"Nguyen","role":"Pharmacist","dept":"Pharmacy","certs":["PharmD"],"contract":"Full-time","maxHrs":48,"pref":"Night","ot":false,"status":"Active","persona":"Avoids overtime when possible","lastOut":"2026-06-20 07:00:00","phone":"+49 174 477 3749","week":["N","O","N","N","O","O","N","N"],"schedHrs":48},{"id":"HOSP-1055","first":"Hassan","last":"Esposito","role":"Physician","dept":"ICU","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":false,"status":"On Leave","persona":"Prefers predictable schedules","lastOut":"2026-06-18 19:00:00","phone":"+49 162 832 4249","week":["O","O","O","O","O","O","O","O"],"schedHrs":0},{"id":"HOSP-1056","first":"Omar","last":"Bakker","role":"Registered Nurse","dept":"Surgery","certs":["BLS","ACLS"],"contract":"Part-time","maxHrs":30,"pref":"Flexible","ot":false,"status":"Active","persona":"Senior staff, mentors new grads","lastOut":"2026-06-20 07:00:00","phone":"+49 161 645 8018","week":["N","O","O","D","O","O","O","O"],"schedHrs":12},{"id":"HOSP-1057","first":"Oskar","last":"Hernandez","role":"Certified Nursing Assistant","dept":"General Medicine","certs":["BLS"],"contract":"Full-time","maxHrs":48,"pref":"Night","ot":true,"status":"Active","persona":"Calm under pressure in codes","lastOut":"2026-06-19 07:00:00","phone":"+49 170 948 8532","week":["O","O","N","O","O","O","N","N"],"schedHrs":36},{"id":"HOSP-1058","first":"Diego","last":"Bauer","role":"Certified Nursing Assistant","dept":"Pediatrics","certs":["BLS"],"contract":"Per-diem","maxHrs":36,"pref":"Day","ot":false,"status":"Active","persona":"Union rep, watches hours closely","lastOut":"— on shift —","phone":"+49 164 546 5397","week":["O","D","O","D","O","D","D","O"],"schedHrs":48},{"id":"HOSP-1059","first":"Felix","last":"Haddad","role":"Registered Nurse","dept":"ICU","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":false,"status":"Active","persona":"Per-diem, very flexible","lastOut":"2026-06-17 19:00:00","phone":"+49 150 606 6325","week":["O","N","O","N","O","O","N","O"],"schedHrs":36},{"id":"HOSP-1060","first":"Marco","last":"Marino","role":"Registered Nurse","dept":"Surgery","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":false,"status":"Active","persona":"Quiet, dependable, rarely calls out","lastOut":"2026-06-19 19:00:00","phone":"+49 150 629 4130","week":["D","O","D","O","D","D","D","O"],"schedHrs":48},{"id":"HOSP-1061","first":"Olivia","last":"Haddad","role":"Registered Nurse","dept":"Maternity","certs":["BLS","NRP"],"contract":"Part-time","maxHrs":30,"pref":"Night","ot":false,"status":"Active","persona":"Reliable, frequently picks up extra shifts","lastOut":"2026-06-20 07:00:00","phone":"+49 152 401 4630","week":["N","N","N","N","O","O","O","O"],"schedHrs":36},{"id":"HOSP-1062","first":"Bruno","last":"Reyes","role":"Registered Nurse","dept":"Surgery","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Night","ot":true,"status":"Active","persona":"Quiet, dependable, rarely calls out","lastOut":"2026-06-20 07:00:00","phone":"+49 160 460 8434","week":["N","N","N","O","N","N","O","O"],"schedHrs":48},{"id":"HOSP-1063","first":"Freya","last":"Schmidt","role":"Registered Nurse","dept":"Cardiology","certs":["BLS","ACLS"],"contract":"Part-time","maxHrs":30,"pref":"Day","ot":false,"status":"On Leave","persona":"Working toward charge-nurse role","lastOut":"2026-06-17 19:00:00","phone":"+49 156 321 8933","week":["O","O","O","O","O","O","O","O"],"schedHrs":0},{"id":"HOSP-1064","first":"Ravi","last":"Kovač","role":"Pharmacy Technician","dept":"Pharmacy","certs":["CPhT"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":true,"status":"Active","persona":"Float-pool veteran, flexible across units","lastOut":"2026-06-18 19:00:00","phone":"+49 161 283 5952","week":["O","O","D","O","O","D","O","O"],"schedHrs":24},{"id":"HOSP-1065","first":"Liam","last":"Lefebvre","role":"Registered Nurse","dept":"General Medicine","certs":["BLS"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":true,"status":"On Leave","persona":"Union rep, watches hours closely","lastOut":"2026-06-17 19:00:00","phone":"+49 153 993 1200","week":["O","O","O","O","O","O","O","O"],"schedHrs":0},{"id":"HOSP-1066","first":"Samir","last":"Petrov","role":"Radiologic Technologist","dept":"Radiology","certs":["ARRT"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":true,"status":"Active","persona":"Has young children, prefers day shifts","lastOut":"— on shift —","phone":"+49 176 166 7565","week":["O","D","O","O","O","D","O","O"],"schedHrs":24},{"id":"HOSP-1067","first":"Aila","last":"Hernandez","role":"Pharmacy Technician","dept":"Pharmacy","certs":["CPhT"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":false,"status":"Active","persona":"Float-pool veteran, flexible across units","lastOut":"2026-06-17 19:00:00","phone":"+49 153 671 7818","week":["O","O","O","O","D","D","D","O"],"schedHrs":36},{"id":"HOSP-1068","first":"Emil","last":"Bianchi","role":"Registered Nurse","dept":"General Medicine","certs":["BLS"],"contract":"Per-diem","maxHrs":36,"pref":"Day","ot":false,"status":"Active","persona":"Senior staff, mentors new grads","lastOut":"— on shift —","phone":"+49 169 857 2625","week":["O","D","D","D","O","O","D","O"],"schedHrs":48},{"id":"HOSP-1069","first":"Chloe","last":"Janssen","role":"Registered Nurse","dept":"Surgery","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":false,"status":"Active","persona":"Open to last-minute cover","lastOut":"— on shift —","phone":"+49 164 805 8699","week":["O","D","O","O","O","D","O","D"],"schedHrs":36},{"id":"HOSP-1070","first":"Theo","last":"Rossi","role":"Registered Nurse","dept":"Surgery","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":true,"status":"Active","persona":"Avoids overtime when possible","lastOut":"2026-06-20 07:00:00","phone":"+49 175 910 4241","week":["N","O","O","O","N","O","N","O"],"schedHrs":24},{"id":"HOSP-1071","first":"Yara","last":"Müller","role":"Registered Nurse","dept":"General Medicine","certs":["BLS"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":true,"status":"Active","persona":"Recently returned from parental leave","lastOut":"— on shift —","phone":"+49 169 866 5728","week":["O","D","O","O","O","O","D","D"],"schedHrs":36},{"id":"HOSP-1072","first":"Selin","last":"Müller","role":"Radiologic Technologist","dept":"Radiology","certs":["ARRT"],"contract":"Part-time","maxHrs":30,"pref":"Flexible","ot":true,"status":"Active","persona":"New grad, still onboarding","lastOut":"2026-06-17 19:00:00","phone":"+49 169 140 8078","week":["O","N","O","N","N","O","D","O"],"schedHrs":48},{"id":"HOSP-1073","first":"Felix","last":"Esposito","role":"Registered Nurse","dept":"Cardiology","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Night","ot":false,"status":"Active","persona":"Reliable, frequently picks up extra shifts","lastOut":"2026-06-18 07:00:00","phone":"+49 174 788 5415","week":["O","O","N","O","O","N","O","N"],"schedHrs":36},{"id":"HOSP-1074","first":"Samir","last":"Rossi","role":"Registered Nurse","dept":"Pediatrics","certs":["BLS","PALS"],"contract":"Part-time","maxHrs":30,"pref":"Flexible","ot":true,"status":"Active","persona":"Union rep, watches hours closely","lastOut":"2026-06-16 19:00:00","phone":"+49 152 581 6700","week":["O","N","O","O","D","O","O","N"],"schedHrs":36},{"id":"HOSP-1075","first":"Carmen","last":"Ivanov","role":"Certified Nursing Assistant","dept":"Oncology","certs":["BLS"],"contract":"Per-diem","maxHrs":36,"pref":"Day","ot":false,"status":"Active","persona":"Prefers predictable schedules","lastOut":"2026-06-16 19:00:00","phone":"+49 176 878 1601","week":["O","O","O","D","D","D","D","O"],"schedHrs":48},{"id":"HOSP-1076","first":"Greta","last":"Kowalski","role":"Registered Nurse","dept":"Oncology","certs":["BLS","OCN"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":false,"status":"Active","persona":"Reliable, frequently picks up extra shifts","lastOut":"— on shift —","phone":"+49 171 990 9889","week":["O","D","N","O","O","O","N","O"],"schedHrs":36},{"id":"HOSP-1077","first":"Malik","last":"Romano","role":"Registered Nurse","dept":"Emergency","certs":["BLS","ACLS","TNCC"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":false,"status":"Active","persona":"Part-time by choice, studying part-time","lastOut":"2026-06-19 19:00:00","phone":"+49 158 662 3146","week":["D","O","D","D","N","O","D","O"],"schedHrs":48},{"id":"HOSP-1078","first":"Lena","last":"Sato","role":"Radiologic Technologist","dept":"Radiology","certs":["ARRT"],"contract":"Per-diem","maxHrs":36,"pref":"Night","ot":true,"status":"Active","persona":"Quiet, dependable, rarely calls out","lastOut":"2026-06-17 07:00:00","phone":"+49 150 665 7684","week":["O","O","O","N","N","O","O","O"],"schedHrs":24},{"id":"HOSP-1079","first":"Mateo","last":"Bianchi","role":"Registered Nurse","dept":"ICU","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":true,"status":"Active","persona":"Cross-trained on two units","lastOut":"2026-06-18 19:00:00","phone":"+49 172 379 7807","week":["O","O","O","O","N","N","O","O"],"schedHrs":24},{"id":"HOSP-1080","first":"Janek","last":"Abebe","role":"Registered Nurse","dept":"Surgery","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":false,"status":"Active","persona":"Night-owl, happy on nights","lastOut":"2026-06-17 19:00:00","phone":"+49 177 171 5526","week":["O","O","O","O","D","O","O","O"],"schedHrs":12},{"id":"HOSP-1081","first":"Aaron","last":"Ivanov","role":"Registered Nurse","dept":"General Medicine","certs":["BLS"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":false,"status":"Active","persona":"Union rep, watches hours closely","lastOut":"2026-06-20 07:00:00","phone":"+49 177 252 8316","week":["N","O","N","N","O","D","D","O"],"schedHrs":48},{"id":"HOSP-1082","first":"Mei","last":"Abebe","role":"Registered Nurse","dept":"Oncology","certs":["BLS","OCN"],"contract":"Part-time","maxHrs":30,"pref":"Day","ot":false,"status":"Active","persona":"Float-pool veteran, flexible across units","lastOut":"2026-06-19 19:00:00","phone":"+49 168 492 4826","week":["D","O","D","O","O","D","O","O"],"schedHrs":24},{"id":"HOSP-1083","first":"Carmen","last":"Rossi","role":"Certified Nursing Assistant","dept":"Oncology","certs":["BLS"],"contract":"Part-time","maxHrs":30,"pref":"Flexible","ot":true,"status":"Active","persona":"Night-owl, happy on nights","lastOut":"2026-06-19 19:00:00","phone":"+49 165 137 3068","week":["D","O","O","O","D","N","N","O"],"schedHrs":36},{"id":"HOSP-1084","first":"Dunia","last":"Bakker","role":"Physician","dept":"Oncology","certs":["BLS","ACLS"],"contract":"Per-diem","maxHrs":36,"pref":"Night","ot":true,"status":"Active","persona":"Night-owl, happy on nights","lastOut":"2026-06-17 07:00:00","phone":"+49 163 991 3529","week":["O","O","O","O","O","O","N","N"],"schedHrs":24},{"id":"HOSP-1085","first":"Omar","last":"Abebe","role":"Registered Nurse","dept":"Cardiology","certs":["BLS","ACLS"],"contract":"Part-time","maxHrs":30,"pref":"Night","ot":false,"status":"Active","persona":"Quiet, dependable, rarely calls out","lastOut":"2026-06-20 07:00:00","phone":"+49 162 424 8994","week":["N","N","N","O","O","O","O","N"],"schedHrs":36},{"id":"HOSP-1086","first":"Tomas","last":"Rossi","role":"Pharmacist","dept":"Pharmacy","certs":["PharmD"],"contract":"Part-time","maxHrs":30,"pref":"Flexible","ot":false,"status":"Active","persona":"Open to last-minute cover","lastOut":"2026-06-17 19:00:00","phone":"+49 153 878 2646","week":["O","O","O","D","O","N","O","D"],"schedHrs":36},{"id":"HOSP-1087","first":"Selin","last":"Kovač","role":"Nurse Practitioner","dept":"Cardiology","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":true,"status":"Active","persona":"Night-owl, happy on nights","lastOut":"2026-06-20 07:00:00","phone":"+49 157 643 7751","week":["N","O","D","N","O","O","D","O"],"schedHrs":36},{"id":"HOSP-1088","first":"Bianca","last":"Dlamini","role":"Registered Nurse","dept":"Pediatrics","certs":["BLS","PALS"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":false,"status":"Active","persona":"Night-owl, happy on nights","lastOut":"2026-06-16 19:00:00","phone":"+49 157 572 5161","week":["O","O","O","D","O","O","O","O"],"schedHrs":12},{"id":"HOSP-1089","first":"Greta","last":"Novak","role":"Nurse Practitioner","dept":"Emergency","certs":["BLS","ACLS","TNCC"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":true,"status":"Active","persona":"Calm under pressure in codes","lastOut":"2026-06-18 19:00:00","phone":"+49 168 406 7951","week":["O","O","O","D","O","O","D","D"],"schedHrs":36},{"id":"HOSP-1090","first":"Anya","last":"Lindgren","role":"Registered Nurse","dept":"Cardiology","certs":["BLS","ACLS"],"contract":"Full-time","maxHrs":48,"pref":"Night","ot":true,"status":"Active","persona":"Recently returned from parental leave","lastOut":"2026-06-19 07:00:00","phone":"+49 172 402 1359","week":["O","O","O","O","O","O","O","O"],"schedHrs":0},{"id":"HOSP-1091","first":"Hana","last":"Costa","role":"Charge Nurse","dept":"Emergency","certs":["BLS","ACLS","TNCC"],"contract":"Part-time","maxHrs":30,"pref":"Flexible","ot":true,"status":"Active","persona":"Union rep, watches hours closely","lastOut":"2026-06-16 19:00:00","phone":"+49 176 393 4770","week":["O","O","N","O","N","O","O","N"],"schedHrs":36},{"id":"HOSP-1092","first":"Hassan","last":"Fernández","role":"Surgeon","dept":"Surgery","certs":["BLS","ACLS","ATLS"],"contract":"Part-time","maxHrs":30,"pref":"Night","ot":false,"status":"Active","persona":"Night-owl, happy on nights","lastOut":"2026-06-19 07:00:00","phone":"+49 170 199 1645","week":["O","N","O","O","O","N","O","N"],"schedHrs":36},{"id":"HOSP-1093","first":"Niko","last":"Sato","role":"Charge Nurse","dept":"Emergency","certs":["BLS","ACLS","TNCC"],"contract":"Part-time","maxHrs":30,"pref":"Day","ot":true,"status":"Active","persona":"Working toward charge-nurse role","lastOut":"— on shift —","phone":"+49 156 235 9837","week":["O","D","D","O","D","D","O","O"],"schedHrs":48},{"id":"HOSP-1094","first":"Nadia","last":"Hoffmann","role":"Nurse Practitioner","dept":"General Medicine","certs":["BLS"],"contract":"Part-time","maxHrs":30,"pref":"Day","ot":false,"status":"Active","persona":"Recently returned from parental leave","lastOut":"— on shift —","phone":"+49 173 991 6549","week":["O","D","D","D","D","O","O","O"],"schedHrs":48},{"id":"HOSP-1095","first":"Isla","last":"Lindgren","role":"Registered Nurse","dept":"ICU","certs":["BLS","ACLS"],"contract":"Per-diem","maxHrs":36,"pref":"Flexible","ot":false,"status":"Active","persona":"Quiet, dependable, rarely calls out","lastOut":"2026-06-18 19:00:00","phone":"+49 161 192 7464","week":["O","O","O","O","O","O","O","O"],"schedHrs":0},{"id":"HOSP-1096","first":"Liam","last":"Novak","role":"Registered Nurse","dept":"General Medicine","certs":["BLS"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":true,"status":"Active","persona":"Calm under pressure in codes","lastOut":"2026-06-17 19:00:00","phone":"+49 153 791 4830","week":["O","O","D","N","O","N","O","O"],"schedHrs":36},{"id":"HOSP-1097","first":"Rosa","last":"Nguyen","role":"Pharmacy Technician","dept":"Pharmacy","certs":["CPhT"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":true,"status":"Active","persona":"Commutes far, dislikes back-to-backs","lastOut":"2026-06-19 19:00:00","phone":"+49 179 817 5951","week":["D","O","O","O","O","D","O","N"],"schedHrs":24},{"id":"HOSP-1098","first":"Carmen","last":"Müller","role":"Registered Nurse","dept":"Pediatrics","certs":["BLS","PALS"],"contract":"Full-time","maxHrs":48,"pref":"Flexible","ot":true,"status":"Active","persona":"Quiet, dependable, rarely calls out","lastOut":"2026-06-18 19:00:00","phone":"+49 154 497 8432","week":["O","N","O","D","O","N","O","O"],"schedHrs":36},{"id":"HOSP-1099","first":"Oskar","last":"Wagner","role":"Registered Nurse","dept":"General Medicine","certs":["BLS"],"contract":"Part-time","maxHrs":30,"pref":"Day","ot":true,"status":"Active","persona":"Union rep, watches hours closely","lastOut":"2026-06-17 19:00:00","phone":"+49 169 517 5583","week":["O","O","O","O","D","D","D","O"],"schedHrs":36},{"id":"HOSP-1100","first":"Mia","last":"Reyes","role":"Registered Nurse","dept":"Oncology","certs":["BLS","OCN"],"contract":"Full-time","maxHrs":48,"pref":"Day","ot":true,"status":"On Leave","persona":"Calm under pressure in codes","lastOut":"2026-06-16 19:00:00","phone":"+49 167 760 6876","week":["O","O","O","O","O","O","O","O"],"schedHrs":0}];

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
:root{
  --ink:#0E1726;--ink-2:#172234;--ink-3:#22304a;--paper:#EEF2F6;--surface:#FFFFFF;--surface-2:#F5F8FB;
  --line:#E1E7EF;--line-strong:#CBD4E0;--text:#16202F;--muted:#64718A;--muted-2:#95A1B5;
  --agent:#0E9F8E;--agent-soft:#DEF5F1;--agent-ink:#0a7a6d;--gap:#E5484D;--gap-soft:#FBE7E7;
  --ok:#1A8F55;--ok-soft:#E4F4EC;--warn:#C9870C;--warn-soft:#FBF0DA;--pend:#5B6B86;--pend-soft:#EAEEF4;
}
*{box-sizing:border-box}
.rl-root{font-family:'Inter',system-ui,sans-serif;color:var(--text);background:var(--paper);min-height:100vh;display:flex;font-size:14px;line-height:1.45}
.rl-root button{font-family:inherit;cursor:pointer}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.rl-side{width:240px;flex:0 0 240px;background:var(--ink);color:#C2CCDB;display:flex;flex-direction:column;padding:22px 16px;position:sticky;top:0;height:100vh}
.rl-brand{display:flex;gap:11px;align-items:center;padding:0 6px 4px}
.rl-mark{width:34px;height:34px;border-radius:9px;background:linear-gradient(140deg,var(--agent),#27c2b0);display:grid;place-items:center;flex:0 0 34px;box-shadow:0 4px 14px rgba(14,159,142,.4)}
.rl-mark svg{width:19px;height:19px}
.rl-brand h1{font-family:'Space Grotesk';font-size:17px;font-weight:600;color:#fff;margin:0;letter-spacing:-.02em}
.rl-brand span{font-size:11px;color:var(--muted-2);display:block;margin-top:1px}
.rl-nav{margin-top:26px;display:flex;flex-direction:column;gap:3px}
.rl-nav button{display:flex;align-items:center;gap:11px;width:100%;background:none;border:0;color:#A6B2C5;padding:9px 11px;border-radius:9px;font-size:13.5px;font-weight:500;text-align:left;transition:.12s}
.rl-nav button:hover{background:var(--ink-2);color:#E6EAF2}
.rl-nav button.on{background:var(--ink-3);color:#fff}
.rl-nav .ct{margin-left:auto;font-size:11px;font-weight:600;background:#2c3a55;color:#cfd6e6;padding:1px 7px;border-radius:20px;min-width:20px;text-align:center}
.rl-agent{margin-top:auto;background:var(--ink-2);border:1px solid #243049;border-radius:11px;padding:12px}
.rl-agent .row{display:flex;align-items:center;gap:8px;font-size:12px;color:#cfd6e6;font-weight:500}
.rl-dot{width:8px;height:8px;border-radius:50%;background:var(--agent);animation:pulse 2s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(14,159,142,.5)}70%{box-shadow:0 0 0 7px rgba(14,159,142,0)}100%{box-shadow:0 0 0 0 rgba(14,159,142,0)}}
.rl-agent p{font-size:11px;color:var(--muted-2);margin:7px 0 0;line-height:1.4}
.rl-main{flex:1;min-width:0;display:flex;flex-direction:column}
.rl-top{background:var(--surface);border-bottom:1px solid var(--line);padding:16px 26px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:5}
.rl-top h2{font-family:'Space Grotesk';font-size:18px;font-weight:600;margin:0;letter-spacing:-.02em}
.rl-top .sub{font-size:12.5px;color:var(--muted);margin-top:1px}
.rl-top .spacer{flex:1}
.btn{border:1px solid var(--line-strong);background:var(--surface);color:var(--text);padding:8px 14px;border-radius:9px;font-size:13px;font-weight:500;display:inline-flex;align-items:center;gap:7px;transition:.12s}
.btn:hover{border-color:var(--muted-2);background:var(--surface-2)}
.btn svg{width:15px;height:15px}
.rl-body{flex:1;padding:22px 26px 30px;overflow:auto}
.split{display:grid;grid-template-columns:1fr 440px;gap:18px;align-items:start}
@media(max-width:1100px){.split{grid-template-columns:1fr}}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:14px}
.panel-h{padding:13px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:9px}
.panel-h h3{font-family:'Space Grotesk';font-size:13.5px;font-weight:600;margin:0}
.panel-h .pill{margin-left:auto;font-size:11px;color:var(--muted);background:var(--surface-2);border:1px solid var(--line);padding:2px 9px;border-radius:20px}
.chat{display:flex;flex-direction:column;height:calc(100vh - 150px);min-height:480px}
.chat-scroll{flex:1;overflow:auto;padding:18px 18px 8px}
.msg{display:flex;gap:10px;margin-bottom:16px;max-width:90%}
.msg.user{margin-left:auto;flex-direction:row-reverse}
.av{width:30px;height:30px;border-radius:8px;flex:0 0 30px;display:grid;place-items:center;font-size:12px;font-weight:600;color:#fff}
.av.agent{background:var(--agent)}.av.user{background:var(--ink-3)}
.av svg{width:16px;height:16px}
.bub{padding:10px 13px;border-radius:12px;font-size:13.5px;line-height:1.55}
.msg.agent .bub{background:var(--surface-2);border:1px solid var(--line);border-top-left-radius:3px}
.msg.user .bub{background:var(--ink);color:#fff;border-top-right-radius:3px}
.bub b{font-weight:600}
.typing{display:inline-flex;gap:4px;padding:4px 2px}
.typing i{width:6px;height:6px;border-radius:50%;background:var(--muted-2);animation:tp 1.2s infinite}
.typing i:nth-child(2){animation-delay:.2s}.typing i:nth-child(3){animation-delay:.4s}
@keyframes tp{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
.chips{display:flex;flex-wrap:wrap;gap:8px;padding:0 18px 12px}
.chip{font-size:12px;color:var(--agent-ink);background:var(--agent-soft);border:1px solid #bfe9e2;padding:6px 11px;border-radius:20px;cursor:pointer}
.chip:hover{filter:brightness(.97)}
.composer{display:flex;gap:10px;padding:12px 16px;border-top:1px solid var(--line)}
.composer input{flex:1;border:1px solid var(--line-strong);border-radius:10px;padding:10px 13px;font-size:13.5px;font-family:inherit;outline:none}
.composer input:focus{border-color:var(--agent)}
.composer button{background:var(--agent);border:0;color:#fff;border-radius:10px;padding:0 16px;font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px}
.composer button:disabled{opacity:.5;cursor:not-allowed}
.composer button svg{width:15px;height:15px}
.gapcard{margin:14px 16px;border-radius:12px;border:1px solid var(--gap);background:var(--gap-soft);padding:14px}
.gapcard.filled{border-color:var(--ok);background:var(--ok-soft)}
.gapcard .gh{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gap)}
.gapcard.filled .gh{color:var(--ok)}
.gapcard .gh .live{margin-left:auto;font-family:'JetBrains Mono';font-size:12px;background:#fff;border:1px solid var(--line);padding:1px 8px;border-radius:20px;color:var(--text)}
.gapcard h4{font-family:'Space Grotesk';font-size:16px;margin:8px 0 2px}
.gapcard .gm{font-size:12.5px;color:var(--muted)}
.gapcard .gtime{font-family:'JetBrains Mono';font-size:12px;margin-top:6px}
.gapcard .req{margin-top:7px;display:flex;gap:5px;flex-wrap:wrap}
.cq{display:inline-block;font-size:10px;font-weight:600;background:#fff;border:1px solid var(--line);color:var(--muted);padding:1px 6px;border-radius:5px}
.funnel{margin:0 16px 4px;padding:10px 12px;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;font-size:12px;color:var(--muted);line-height:1.6}
.funnel b{color:var(--text)}
.funnel .frow{display:flex;justify-content:space-between}
.funnel .frow span:last-child{font-family:'JetBrains Mono'}
.sentbox{margin:0 16px 4px;padding:10px 12px;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;font-size:12px;color:var(--muted);line-height:1.5}
.sentbox .lab{font-weight:600;color:var(--text);font-size:11px;text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:4px}
.clist{padding:6px 10px 12px}
.crow{display:flex;gap:11px;padding:11px;border-radius:10px;align-items:center}
.crow+.crow{border-top:1px solid var(--line)}
.cav{width:34px;height:34px;border-radius:50%;flex:0 0 34px;display:grid;place-items:center;font-family:'Space Grotesk';font-weight:600;font-size:12px;color:#fff;background:var(--ink-3)}
.cinfo{min-width:0;flex:1}
.cinfo .cn{font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px}
.cinfo .cm{font-size:11.5px;color:var(--muted);margin-top:2px}
.otbadge{font-size:9.5px;font-weight:700;color:var(--ok);background:var(--ok-soft);border:1px solid #bfe2cd;padding:0 5px;border-radius:5px}
.cstat{font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;white-space:nowrap}
.st-queued{background:var(--pend-soft);color:var(--pend)}.st-sent{background:var(--agent-soft);color:var(--agent-ink)}
.st-declined{background:var(--warn-soft);color:var(--warn)}.st-noreply{background:var(--pend-soft);color:var(--pend)}
.st-stood{background:var(--pend-soft);color:var(--muted-2)}.st-accepted{background:var(--ok-soft);color:var(--ok)}
.cact{display:flex;gap:5px}
.cact button{border:1px solid var(--line-strong);background:#fff;border-radius:7px;width:26px;height:26px;display:grid;place-items:center;padding:0}
.cact button svg{width:14px;height:14px}
.cact .y{color:var(--ok)}.cact .y:hover{background:var(--ok-soft)}
.cact .n{color:var(--gap)}.cact .n:hover{background:var(--gap-soft)}
.emptyp{padding:40px 20px;text-align:center;color:var(--muted)}
.emptyp svg{width:34px;height:34px;color:var(--line-strong);margin-bottom:10px}
.rtable{width:100%;border-collapse:collapse;font-size:12.5px}
.rtable th{text-align:left;background:var(--surface-2);color:var(--muted);font-weight:600;padding:9px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;position:sticky;top:0}
.rtable td{padding:8px 12px;border-top:1px solid var(--line)}
.rtable tr:hover td{background:var(--surface-2)}
.sdot{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500}
.sdot i{width:8px;height:8px;border-radius:50%}
.s-avail i{background:var(--ok)}.s-avail{color:var(--ok)}
.s-leave i{background:var(--muted-2)}.s-leave{color:var(--muted)}
.s-work i{background:var(--gap)}.s-work{color:var(--gap)}
`;

const initials = (f, l) => (f[0] + l[0]).toUpperCase();
const fmtDur = (s) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;

/* ── eligibility engine (the real rules) ── */
function rested(lastOut) {
  if (/on shift/i.test(lastOut)) return false;
  const d = new Date(String(lastOut).replace(" ", "T"));
  if (isNaN(d)) return true;
  const today = new Date(TODAY + "T00:00:00");
  if (d < today) return true;
  return (d.getHours() * 60 + d.getMinutes()) <= 8 * 60 + 30;
}
function evaluate(s, crit) {
  const fails = [];
  if (!crit.roles.includes(s.role)) fails.push("role");
  if (!crit.certs.every((c) => s.certs.includes(c))) fails.push("certs");
  if (s.status !== "Active") fails.push("onleave");
  if (s.week[crit.dayIndex] !== "O") fails.push("working");
  if (!rested(s.lastOut)) fails.push("rest");
  if (s.schedHrs + crit.shiftHours > s.maxHrs) fails.push("cap");
  return { ok: fails.length === 0, fails };
}
function persona(p) {
  let v = 0;
  if (/last-minute|picks up extra|night-owl|reliable/i.test(p)) v += 14;
  if (/avoids overtime|watches hours|dislikes back-to-backs|predictable|young children/i.test(p)) v -= 10;
  return v;
}
function score(s) {
  let v = 0;
  if (s.ot) v += 1000;
  v += (s.maxHrs - s.schedHrs) * 5;
  if (/Night|Flexible/.test(s.pref)) v += 40;
  if (s.contract === "Per-diem") v += 20; else if (s.contract === "Part-time") v += 10;
  v += persona(s.persona);
  return v;
}
function runEngine(staff, crit) {
  const eligible = staff.filter((s) => evaluate(s, crit).ok).sort((a, b) => score(b) - score(a));
  const comp = staff.filter((s) => crit.roles.includes(s.role) && crit.certs.every((c) => s.certs.includes(c)));
  const f = { total: staff.length, competency: comp.length, onleave: 0, working: 0, rest: 0, cap: 0, eligible: eligible.length };
  comp.forEach((s) => {
    if (s.status !== "Active") f.onleave++;
    else if (s.week[crit.dayIndex] !== "O") f.working++;
    else if (!rested(s.lastOut)) f.rest++;
    else if (s.schedHrs + crit.shiftHours > s.maxHrs) f.cap++;
  });
  return { eligible, funnel: f };
}

/* ── parse the sick-call message (Gemini, with scenario fallback) ── */
const DEFAULT_CRIT = { roles: ["Registered Nurse", "Charge Nurse"], certs: ["BLS", "ACLS"], department: "ICU", shift: "night", shiftHours: 12, dayLabel: "Sat 06/20", dayIndex: 1, sick: "" };
async function parseCall(text) {
  const prompt = `You are a hospital staffing dispatcher. From the user's sick-call message extract ONLY JSON:
{"intent":"fill_gap or other","sick_name":"","department":"","roles":["roles that can cover, e.g. Registered Nurse, Charge Nurse"],"certs":["required certifications, e.g. BLS, ACLS"],"shift":"night/day","day_label":"e.g. Sat 06/20 or tonight","reply":"one friendly sentence confirming what you understood"}
If not about covering a shift, intent "other" and answer in reply. ICU competency implies certs BLS and ACLS and roles Registered Nurse, Charge Nurse.`;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`;
    const body = JSON.stringify({ contents: [{ parts: [{ text: text + "\n\n" + prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 600, responseMimeType: "application/json" } });
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error?.message || res.status);
        const t = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
        const c = t.replace(/```json/g, "").replace(/```/g, "").trim();
        const g = JSON.parse(c.slice(c.indexOf("{"), c.lastIndexOf("}") + 1));
        return normalise(g);
      } catch (e) { if (i === 2) throw e; await new Promise((r) => setTimeout(r, 600 * (i + 1))); }
    }
  } catch { return localParse(text); }
}
function normalise(g) {
  if (g.intent && g.intent !== "fill_gap") return { intent: "other", reply: g.reply };
  const roles = (g.roles && g.roles.length) ? g.roles : DEFAULT_CRIT.roles;
  const certs = (g.certs && g.certs.length) ? g.certs.map((c) => c.toUpperCase()) : DEFAULT_CRIT.certs;
  const shift = /day/i.test(g.shift || "") ? "day" : "night";
  let dayIndex = WEEK_LABELS.findIndex((l) => g.day_label && l.toLowerCase().includes((g.day_label || "").toLowerCase().replace("tonight", "06/20").slice(-5)));
  if (dayIndex < 0) dayIndex = 1;
  return { intent: "fill_gap", roles, certs, department: g.department || "", shift, shiftHours: 12, dayLabel: WEEK_LABELS[dayIndex], dayIndex, sick: g.sick_name || "", reply: g.reply };
}
function localParse(text) {
  const t = text.toLowerCase();
  const isGap = /sick|cover|short|gap|shift|night|call|replace|fill|off/.test(t);
  if (!isGap) return { intent: "other", reply: "I fill shift gaps — tell me who's off, which ward, and which shift." };
  return { ...DEFAULT_CRIT, intent: "fill_gap", reply: "Understood — checking who can cover the ICU night shift tonight." };
}

const Icon = {
  bird: <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M16 7h.01M22 5s-2 4-6 4c-5 0-7 3-7 7 0 3 2 4 2 4l-3 0M9 16c-3 0-5-2-5-5"/></svg>,
  send: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  chat: (c = "currentColor") => <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  users: (c = "currentColor") => <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/></svg>,
  alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  up: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 16V4m-5 5 5-5 5 5M5 20h14"/></svg>,
};

const EXAMPLES = [
  "Felix Haddad (ICU, Registered Nurse) just called in sick — need cover for tonight's NIGHT shift (19:00–07:00), Sat 06/20. Needs BLS + ACLS.",
  "We're short an ICU night nurse tonight",
];

export default function App() {
  const [staff, setStaff] = useState(STAFF);
  const [view, setView] = useState("dispatch");
  const [messages, setMessages] = useState([{ role: "agent", text: "Hi — I'm the UKS staffing assistant. Tell me who's called in sick and which shift needs covering. I'll apply the cover rules — right role and certifications, off that night, rested, and under their weekly hours cap — then reach out to the best people." }]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [gap, setGap] = useState(null);
  const [cands, setCands] = useState([]);
  const [filledBy, setFilledBy] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  const scrollRef = useRef(); const timers = useRef([]); const filledRef = useRef(false); const gapRef = useRef(null); const fileRef = useRef();
  useEffect(() => { gapRef.current = gap; }, [gap]);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages, typing]);
  useEffect(() => { if (!gap || filledBy) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [gap, filledBy]);

  const pushAgent = (text) => setMessages((m) => [...m, { role: "agent", text }]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  function resetGap() { clearTimers(); filledRef.current = false; setGap(null); setCands([]); setFilledBy(null); }

  async function send(text) {
    if (!text.trim() || busy) return;
    setInput(""); setBusy(true);
    setMessages((m) => [...m, { role: "user", text }]);
    resetGap(); setTyping(true);
    const crit = await parseCall(text);
    setTyping(false);
    if (!crit || crit.intent !== "fill_gap") { pushAgent(crit?.reply || "Tell me who's off and which shift to cover."); setBusy(false); return; }

    const { eligible, funnel } = runEngine(staff, crit);
    const g = { ...crit, openedAt: Date.now(), funnel };
    setGap(g); gapRef.current = g;

    pushAgent(`${crit.reply || "Got it."} I need a **${crit.roles.join(" / ")}** with **${crit.certs.join(" + ")}**, off on ${crit.dayLabel}, rested, and under their weekly cap.`);

    if (eligible.length === 0) { pushAgent("After applying the rules, **no one is eligible** tonight. I'd escalate to the on-call list or an agency — want me to draft that request?"); setBusy(false); return; }

    pushAgent(`Checked **${funnel.total} staff** → **${funnel.competency}** are ${crit.roles.join("/")} with the right certs → minus ${funnel.onleave} on leave, ${funnel.working} already working that night, ${funnel.rest} not rested, ${funnel.cap} over their hours cap → **${funnel.eligible} eligible**. Best pick: **${eligible[0].first} ${eligible[0].last}** (${eligible[0].ot ? "overtime-OK, " : ""}${eligible[0].maxHrs - eligible[0].schedHrs}h headroom).`);

    const contacted = eligible.slice(0, 3).map((c) => ({ ...c, status: "queued" }));
    const rest = eligible.slice(3).map((c) => ({ ...c, status: "queued" }));
    setCands([...contacted, ...rest]);
    pushAgent(`Reaching out to the top **${contacted.length}** now, in priority order. I'll confirm the moment someone accepts.`);
    setBusy(false);
    startOutreach(contacted);
  }

  function startOutreach(contacted) {
    contacted.forEach((c, i) => { const t1 = setTimeout(() => setCands((p) => p.map((x) => x.id === c.id ? { ...x, status: "sent" } : x)), 400 + i * 350); timers.current.push(t1); });
    contacted.forEach((c, i) => {
      const accept = i === 0;
      const delay = accept ? 5200 + Math.random() * 1500 : 2600 + Math.random() * 2200;
      const t = setTimeout(() => { if (filledRef.current) return; if (accept) fill(c); else respond(c, Math.random() < 0.6 ? "declined" : "noreply"); }, delay);
      timers.current.push(t);
    });
  }
  function respond(c, outcome) { if (filledRef.current) return; setCands((p) => p.map((x) => x.id === c.id ? { ...x, status: outcome } : x)); pushAgent(outcome === "declined" ? `${c.first} can't make it tonight.` : `No reply from ${c.first} yet — keeping the others going.`); }
  function fill(c) {
    if (filledRef.current) return; filledRef.current = true; clearTimers();
    setCands((p) => p.map((x) => x.id === c.id ? { ...x, status: "accepted" } : (x.status === "sent" || x.status === "queued") ? { ...x, status: "stood" } : x));
    setFilledBy(c); setNow(Date.now());
    const secs = Math.max(1, Math.round((Date.now() - (gapRef.current?.openedAt || Date.now())) / 1000));
    pushAgent(`✅ **${c.first} ${c.last} accepted.** The shift is covered. I've updated the schedule and notified the charge nurse. **Filled in ${fmtDur(secs)}.**`);
  }
  function manual(c, ok) { if (filledRef.current) return; if (ok) fill(c); else { setCands((p) => p.map((x) => x.id === c.id ? { ...x, status: "declined" } : x)); pushAgent(`${c.first} declined.`); } }

  function onXLSX(file) {
    const r = new FileReader();
    r.onload = () => { try { const parsed = parseWorkbook(r.result); if (parsed.length) { setStaff(parsed); pushAgent(`Loaded **${parsed.length}** staff from ${file.name}.`); setView("roster"); } else pushAgent("I read the file but found no staff rows — check it has a Roster and Weekly_Schedule sheet."); } catch (e) { pushAgent("I couldn't parse that workbook — make sure it has Roster and Weekly_Schedule sheets like the original."); } };
    r.readAsArrayBuffer(file);
  }

  const elapsed = gap ? Math.round((now - gap.openedAt) / 1000) : 0;
  const activeCount = staff.filter((s) => s.status === "Active").length;

  return (
    <div className="rl-root">
      <style>{STYLES}</style>
      <aside className="rl-side">
        <div className="rl-brand"><div className="rl-mark">{Icon.bird}</div><div><h1>Nightingale</h1><span>UKS Homburg · Staffing</span></div></div>
        <nav className="rl-nav">
          <button className={view === "dispatch" ? "on" : ""} onClick={() => setView("dispatch")}>{Icon.chat(view === "dispatch" ? "#fff" : "#A6B2C5")} Dispatch</button>
          <button className={view === "roster" ? "on" : ""} onClick={() => setView("roster")}>{Icon.users(view === "roster" ? "#fff" : "#A6B2C5")} Roster <span className="ct">{staff.length}</span></button>
        </nav>
        <div className="rl-agent"><div className="row"><span className="rl-dot" /> Agent on call</div><p>{activeCount} active staff loaded · schedule {WEEK_LABELS[0]}–{WEEK_LABELS[WEEK_LABELS.length - 1]}.</p></div>
      </aside>

      <div className="rl-main">
        <header className="rl-top">
          <div><h2>{view === "dispatch" ? "Dispatch" : "Staff roster"}</h2><div className="sub">{view === "dispatch" ? "Message the agent to fill a shift" : "Roster + this week's schedule"}</div></div>
          <div className="spacer" />
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={(e) => e.target.files[0] && onXLSX(e.target.files[0])} />
          <button className="btn" onClick={() => fileRef.current?.click()}>{Icon.up} Load schedule (.xlsx)</button>
          {gap && <button className="btn" onClick={resetGap}>New gap</button>}
        </header>

        <div className="rl-body">
          {view === "dispatch" ? (
            <div className="split">
              <div className="panel chat">
                <div className="chat-scroll" ref={scrollRef}>
                  {messages.map((m, i) => (
                    <div key={i} className={"msg " + m.role}>
                      <div className={"av " + m.role}>{m.role === "agent" ? Icon.bird : "HR"}</div>
                      <div className="bub" dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") }} />
                    </div>
                  ))}
                  {typing && <div className="msg agent"><div className="av agent">{Icon.bird}</div><div className="bub"><span className="typing"><i /><i /><i /></span></div></div>}
                </div>
                {messages.length <= 1 && <div className="chips">{EXAMPLES.map((e, i) => <button key={i} className="chip" onClick={() => send(e)}>{e.length > 60 ? e.slice(0, 58) + "…" : e}</button>)}</div>}
                <div className="composer">
                  <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)} placeholder="e.g. ICU nurse off sick — need night cover tonight" />
                  <button disabled={busy || !input.trim()} onClick={() => send(input)}>{Icon.send} Send</button>
                </div>
              </div>
              <FillPanel gap={gap} cands={cands} filledBy={filledBy} elapsed={elapsed} onManual={manual} />
            </div>
          ) : (
            <div className="panel">
              <div className="panel-h"><h3>Roster &amp; schedule</h3><span className="pill">{activeCount} active</span></div>
              <div style={{ overflow: "auto", maxHeight: "calc(100vh - 200px)" }}>
                <table className="rtable">
                  <thead><tr><th>Name</th><th>Role</th><th>Dept</th><th>Certs</th><th>Tonight</th><th>Hrs/7d</th><th>Max</th><th>OT</th><th>Status</th></tr></thead>
                  <tbody>{staff.map((s) => {
                    const tn = s.week[1]; const sc = s.status !== "Active" ? "s-leave" : tn === "O" ? "s-avail" : "s-work";
                    return (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>{s.first} {s.last}</td><td>{s.role}</td><td>{s.dept}</td>
                        <td>{s.certs.map((c) => <span key={c} className="cq">{c}</span>)}</td>
                        <td><span className={"sdot " + sc}><i />{tn === "O" ? "Off" : tn === "N" ? "Night" : tn === "D" ? "Day" : tn}</span></td>
                        <td className="mono">{s.schedHrs}</td><td className="mono">{s.maxHrs}</td><td>{s.ot ? "Yes" : "—"}</td><td>{s.status}</td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FillPanel({ gap, cands, filledBy, elapsed, onManual }) {
  if (!gap) return <div className="panel"><div className="emptyp">{Icon.alert}<div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>No open shift</div>Report a sick-call and the live fill appears here — eligibility funnel, ranked candidates, and time to cover.</div></div>;
  const contacted = cands.filter((c) => c.status !== "queued");
  const queued = cands.filter((c) => c.status === "queued");
  const sl = { queued: "Queued", sent: "Contacting…", declined: "Declined", noreply: "No reply", stood: "Stood down", accepted: "Accepted ✓" };
  const scn = { queued: "st-queued", sent: "st-sent", declined: "st-declined", noreply: "st-noreply", stood: "st-stood", accepted: "st-accepted" };
  const f = gap.funnel;
  return (
    <div className="panel">
      <div className="panel-h"><h3>Live fill</h3><span className="pill">{f.eligible} eligible</span></div>
      <div className={"gapcard" + (filledBy ? " filled" : "")}>
        <div className="gh">{filledBy ? <>{Icon.check} Covered</> : <>{Icon.alert} Open shift</>}<span className="live mono">{filledBy ? `filled ${fmtDur(elapsed)}` : `open ${fmtDur(elapsed)}`}</span></div>
        <h4>{gap.department || "ICU"} · {gap.shift} shift</h4>
        <div className="gm">{gap.sick ? gap.sick + " called in sick" : "cover needed"} · {gap.dayLabel}</div>
        <div className="gtime">{gap.shift === "night" ? "19:00–07:00" : "07:00–19:00"} · 12h</div>
        <div className="req">{gap.roles.map((r) => <span key={r} className="cq">{r}</span>)}{gap.certs.map((c) => <span key={c} className="cq">{c}</span>)}</div>
      </div>
      <div className="funnel">
        <div className="frow"><span>Staff checked</span><span><b>{f.total}</b></span></div>
        <div className="frow"><span>Right role + certs</span><span>{f.competency}</span></div>
        <div className="frow"><span>− on leave</span><span>{f.onleave}</span></div>
        <div className="frow"><span>− working that night</span><span>{f.working}</span></div>
        <div className="frow"><span>− not rested</span><span>{f.rest}</span></div>
        <div className="frow"><span>− over hours cap</span><span>{f.cap}</span></div>
        <div className="frow" style={{ borderTop: "1px solid var(--line)", marginTop: 4, paddingTop: 4 }}><span><b>Eligible</b></span><span><b>{f.eligible}</b></span></div>
      </div>
      {contacted.length > 0 && <div className="sentbox"><span className="lab">Message sent</span>"Hi — UKS staffing here. We have an open {gap.department} {gap.shift} shift {gap.dayLabel} ({gap.shift === "night" ? "19:00–07:00" : "07:00–19:00"}). Can you cover? Reply YES to accept."</div>}
      <div className="clist">
        {cands.length === 0 && <div className="emptyp" style={{ padding: 24 }}>No eligible staff for this shift.</div>}
        {[...contacted, ...queued].map((c) => (
          <div key={c.id} className="crow">
            <div className="cav">{initials(c.first, c.last)}</div>
            <div className="cinfo">
              <div className="cn">{c.first} {c.last} {c.ot && <span className="otbadge">OT OK</span>}</div>
              <div className="cm">{c.role} · {c.dept} · {c.contract} · {c.maxHrs - c.schedHrs}h headroom · {c.pref}</div>
            </div>
            {c.status === "sent" && !filledBy ? (
              <div className="cact"><button className="y" title="Accept on their behalf" onClick={() => onManual(c, true)}>{Icon.check}</button><button className="n" title="Decline" onClick={() => onManual(c, false)}>{Icon.x}</button></div>
            ) : <span className={"cstat " + (scn[c.status] || "st-queued")}>{sl[c.status] || "Queued"}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── .xlsx import via SheetJS ── */
function parseWorkbook(buf) {
  const wb = XLSX.read(buf, { type: "array" });
  const pick = (re) => wb.SheetNames.find((n) => re.test(n));
  const roster = XLSX.utils.sheet_to_json(wb.Sheets[pick(/roster/i)], { defval: "" });
  const sched = XLSX.utils.sheet_to_json(wb.Sheets[pick(/schedule|weekly/i)], { defval: "" });
  const schedBy = {};
  sched.forEach((row) => { const id = row["Employee ID"] || row["EmployeeID"] || row["ID"]; if (id) schedBy[id] = row; });
  const dayKeys = sched.length ? Object.keys(sched[0]).filter((k) => /\d\d\/\d\d/.test(k)) : WEEK_LABELS;
  const hrsKey = sched.length ? Object.keys(sched[0]).find((k) => /scheduled/i.test(k)) : null;
  return roster.map((p) => {
    const id = p["Employee ID"]; const sr = schedBy[id] || {};
    const week = dayKeys.map((k) => String(sr[k] || "").trim());
    return {
      id, first: p["First Name"] || "", last: p["Last Name"] || "", role: p["Role"] || "", dept: p["Department"] || "",
      certs: String(p["Certifications"] || "").split(",").map((c) => c.trim()).filter(Boolean),
      contract: p["Contract"] || "", maxHrs: +p["Max Hrs/Week"] || 0, pref: p["Shift Preference"] || "Flexible",
      ot: String(p["Overtime OK"]).toLowerCase().startsWith("y"), status: p["Status"] || "Active",
      persona: p["Persona / Notes"] || "", lastOut: String(p["Last Clock Out"] || ""), phone: p["Phone"] || "",
      week: week.length ? week : WEEK_LABELS.map(() => "O"), schedHrs: hrsKey ? (+sr[hrsKey] || 0) : 0,
    };
  }).filter((s) => s.id);
}
