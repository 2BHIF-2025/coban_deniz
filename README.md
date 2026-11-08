# coban_deniz
**Quizbattle gegen einen Roboter**

Man spielt ein Quiz gegen einen Bot und kann sich vorher eine Kategorie aussuchen, zum Beispiel IT oder Schule. Wer will, kann auch eine eigene Kategorie erstellen.

Der Bot hat drei Schwierigkeitsstufen: leicht (50 % Trefferquote), mittel (60 %) und schwer (80 %). Dafür zieht er bei jeder Frage eine Zufallszahl zwischen 1 und 100. Liegt sie unter oder bei der jeweiligen Prozentzahl, antwortet er richtig, sonst nimmt er irgendeine zufällige Antwort. Für jede Frage gibt es einen Timer von 10 Sekunden, und nach jeder Frage wird der aktuelle Punktestand angezeigt. Wie bei Kahoot sieht man dabei auch den Punkteunterschied zwischen Spieler und Bot.

Fragen kann man hoch- und herunterladen. Das Format sieht so aus:

`Q: Frage A: T: Antwort1 F: Antwort2 F: Antwort3 F: Antwort4`

(T steht für die richtige Antwort, F für die falschen.)

Im Profil gibt es folgende Infos:
- Username
- Accuracy: Dafür werden alle beantworteten und alle richtig beantworteten Fragen mitgezählt. Die Formel ist p = A / G · 100 (A = richtige Antworten, G = Gesamtzahl der Fragen).
- Siege auf leicht, mittel und schwer
- Anzahl der Spiele gegen den Bot
