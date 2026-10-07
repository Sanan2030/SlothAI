import unittest
from acquire_aztc import segment


class AcquisitionTests(unittest.TestCase):
    def test_sentences_and_initials(self):
        sentences, _ = segment({'source': 'ANL', 'text': 'Müəllim bu gün yeni dərsi hazırladı. Uşaqlar isə kitabı diqqətlə oxudular.'})
        self.assertEqual(len(sentences), 2)
        sentences, _ = segment({'source': 'ANL', 'text': 'A. Məmmədov bu gün yeni sənədi imzaladı.'})
        self.assertEqual(sentences, ['A. Məmmədov bu gün yeni sənədi imzaladı.'])

    def test_quarantine(self):
        for source in ['wikipedia', 'unknown', 'azadlig', 'muselmanlar']:
            self.assertEqual(segment({'source': source, 'text': 'Bu mətn yeni məlumatları ətraflı şəkildə təqdim edir.'})[0], [])

    def test_fragment_language_and_contact_filters(self):
        for text in ['The server is running normally today.', 'Yeni mətn', '<b>Bu yeni mətndir və etibarlı görünür.</b>', 'Bu gün test@example.org ünvanına məktub göndərildi.']:
            self.assertEqual(segment({'source': 'ANL', 'text': text})[0], [])


if __name__ == '__main__':
    unittest.main()
