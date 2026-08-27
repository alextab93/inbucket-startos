require "rails_helper"
require "mail"

RSpec.describe "Email fixture corpus" do
  def fixture(name)
    Mail.read(Rails.root.join("spec/fixtures/email/#{name}.eml"))
  end

  it "covers plain text links and UTF-8 content" do
    expect(fixture("plaintext-link").body.decoded).to include("https://example.com/account")
    utf8 = fixture("utf8")
    expect(utf8.body.decoded.force_encoding(utf8.charset)).to include("Español", "日本語")
  end

  it "covers alternative, responsive, and table HTML" do
    expect(fixture("multipart-alternative").html_part.decoded).to include("<strong>123456</strong>")
    expect(fixture("responsive-html").body.decoded).to include("@media", "Verify account")
    expect(fixture("table-layout").body.decoded).to include("<table", "Order confirmed")
  end

  it "covers CID, attachment, and remote resources" do
    expect(fixture("cid-logo").all_parts.map(&:content_id)).to include("<logo.png>")
    expect(fixture("attachment").attachments.map(&:filename)).to eq(["example.pdf"])
    expect(fixture("remote-images").body.decoded).to include("tracker.gif", "background-image")
  end

  it "covers malformed and encoded headers without losing displayable content" do
    expect(fixture("malformed-but-displayable").text_part.decoded).to include("final MIME boundary is missing")
    expect(fixture("encoded-subject").subject).to eq("Confirmación de cuenta")
  end
end
