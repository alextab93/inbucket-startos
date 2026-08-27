require "rails_helper"

RSpec.describe "Inbucket flow", type: :request do
  let(:mailbox) { "candidate" }
  let(:message_id) { "20260811T120000-0001" }
  let(:messages) do
    [
      {
        mailbox: mailbox,
        id: message_id,
        from: "sender@example.com",
        subject: "Hello",
        date: "2026-08-11T12:00:00Z",
        size: 512
      }
    ]
  end
  let(:message) do
    {
      mailbox: mailbox,
      id: message_id,
      from: "sender@example.com",
      subject: "Hello",
      body: { text: "Welcome", html: "<p>Welcome</p>" },
      header: { To: ["candidate@example.com"] },
      attachments: []
    }
  end
  let(:monitor_header) do
    {
      "mailbox" => mailbox,
      "id" => message_id,
      "subject" => "Hello",
      "date" => "2026-08-11T12:00:00Z"
    }
  end

  it "requires a private session" do
    get "/v1/inbucket/mailboxes/#{mailbox}"

    expect(response).to have_http_status(:unauthorized)
    expect(response.parsed_body).to eq("error" => "unauthorized")
  end

  it "returns mailbox contents" do
    authenticate
    stub_json("/api/v1/mailbox/#{mailbox}", messages)

    get "/v1/inbucket/mailbox", params: { name: mailbox }

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to eq(JSON.parse(messages.to_json).map { |item| item.merge("read" => false) })
    expect(response.headers["Cache-Control"]).to eq("private, no-store")
  end

  it "returns persistent read state with mailbox contents" do
    user = authenticate
    stub_json("/api/v1/mailbox/#{mailbox}", messages)

    patch "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/read"
    get "/v1/inbucket/mailboxes/#{mailbox}"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to eq(JSON.parse(messages.to_json).map { |item| item.merge("read" => true) })
    expect(MessageRead.where(user:, mailbox:, message_id:).count).to eq(1)
  end

  it "marks a message read idempotently" do
    user = authenticate

    2.times do
      patch "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/read"
      expect(response).to have_http_status(:no_content)
    end

    expect(MessageRead.where(user:, mailbox:, message_id:).count).to eq(1)
  end

  it "saves a mailbox after it is confirmed to contain messages" do
    authenticate
    stub_json("/api/v1/mailbox/#{mailbox}", messages)

    get "/v1/inbucket/mailboxes/#{mailbox}"

    expect(response).to have_http_status(:ok)
    expect(Mailbox.find_by(name: mailbox)&.name).to eq(mailbox)
  end

  it "does not save an empty mailbox" do
    authenticate
    stub_json("/api/v1/mailbox/#{mailbox}", [])

    get "/v1/inbucket/mailboxes/#{mailbox}"

    expect(response).to have_http_status(:ok)
    expect(Mailbox.find_by(name: mailbox)).to be_nil
  end

  it "returns saved mailboxes" do
    authenticate
    Mailbox.record("alerts")
    Mailbox.record("candidate")

    get "/v1/inbucket/mailboxes"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to eq(%w[alerts candidate])
  end

  it "returns archived mailboxes separately" do
    Mailbox.record("alerts").update!(archived: true)
    Mailbox.record("candidate")
    authenticate
    stub_json("/api/v1/mailbox/alerts", [])

    get "/v1/inbucket/mailboxes", params: { archived: true }

    expect(response.parsed_body).to eq([{ "name" => "alerts", "message_count" => 0 }])
  end

  it "returns recent monitor message summaries" do
    authenticate
    MonitorMessage.record(monitor_header)

    get "/v1/inbucket/monitor/messages"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to include(monitor_header)
  end

  it "archives a saved mailbox without purging its messages" do
    authenticate
    Mailbox.record(mailbox)

    patch "/v1/inbucket/mailbox/archive", params: { name: mailbox }

    expect(response).to have_http_status(:no_content)
    expect(Mailbox.find_by(name: mailbox)&.archived?).to be(true)
  end

  it "restores an archived mailbox when it is opened" do
    authenticate
    Mailbox.record(mailbox).update!(archived: true)
    stub_json("/api/v1/mailbox/#{mailbox}", messages)

    get "/v1/inbucket/mailbox", params: { name: mailbox }

    expect(response).to have_http_status(:ok)
    expect(Mailbox.find_by(name: mailbox)&.archived?).to be(false)
  end

  it "returns a parsed message" do
    authenticate
    stub_json("/api/v1/mailbox/#{mailbox}/#{message_id}", message)

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to eq(JSON.parse(message.to_json))
  end

  it "returns message source as plain text" do
    authenticate
    source = "From: sender@example.com\r\nSubject: Hello\r\n\r\nWelcome"
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}/source")
      .to_return(status: 200, body: source, headers: { "Content-Type" => "text/plain" })

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/source"

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq("text/plain")
    expect(response.body).to eq(source)
  end

  it "returns a matching inline image from the message source" do
    authenticate
    source = <<~MESSAGE
      Content-Type: multipart/related; boundary="part"

      --part
      Content-Type: text/html

      <img src="cid:logo-gray.png">
      --part
      Content-Type: image/png
      Content-ID: <logo-gray.png>
      Content-Transfer-Encoding: base64

      aGVsbG8=
      --part--
    MESSAGE
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}/source")
      .to_return(status: 200, body: source, headers: { "Content-Type" => "text/plain" })

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/inline-image", params: { cid: "logo-gray.png" }

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq("image/png")
    expect(response.body).to eq("hello")
  end

  it "matches a URL-encoded content ID without case sensitivity" do
    authenticate
    source = <<~MESSAGE
      Content-Type: multipart/related; boundary="part"

      --part
      Content-Type: text/html

      <img src="cid:Logo One.PNG">
      --part
      Content-Type: image/png
      Content-ID: <Logo One.PNG>
      Content-Transfer-Encoding: base64

      aGVsbG8=
      --part--
    MESSAGE
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}/source")
      .to_return(status: 200, body: source, headers: { "Content-Type" => "text/plain" })

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/inline-image?cid=logo%20one.png"

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq("image/png")
    expect(response.body).to eq("hello")
  end

  it "does not expose a non-image content ID" do
    authenticate
    source = <<~MESSAGE
      Content-Type: multipart/related; boundary="part"

      --part
      Content-Type: text/html

      <img src="cid:document">
      --part
      Content-Type: text/html
      Content-ID: <document>

      <script>alert('unsafe')</script>
      --part--
    MESSAGE
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}/source")
      .to_return(status: 200, body: source, headers: { "Content-Type" => "text/plain" })

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/inline-image", params: { cid: "document" }

    expect(response).to have_http_status(:not_found)
  end

  it "does not expose an SVG content ID" do
    authenticate
    source = <<~MESSAGE
      Content-Type: multipart/related; boundary="part"

      --part
      Content-Type: text/html

      <img src="cid:vector">
      --part
      Content-Type: image/svg+xml
      Content-ID: <vector>

      <svg xmlns="http://www.w3.org/2000/svg"><script>alert('unsafe')</script></svg>
      --part--
    MESSAGE
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}/source")
      .to_return(status: 200, body: source, headers: { "Content-Type" => "text/plain" })

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/inline-image", params: { cid: "vector" }

    expect(response).to have_http_status(:not_found)
  end

  it "lists message attachments" do
    authenticate
    source = attachment_source
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}/source")
      .to_return(status: 200, body: source, headers: { "Content-Type" => "text/plain" })

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/attachments"

    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to eq([{ "index" => 0, "filename" => "resume.pdf", "content_type" => "application/pdf", "size" => 5 }])
  end

  it "downloads a message attachment instead of rendering it" do
    authenticate
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}/source")
      .to_return(status: 200, body: attachment_source, headers: { "Content-Type" => "text/plain" })

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/attachments/0"

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq("application/pdf")
    expect(response.headers["Content-Disposition"]).to include("attachment")
    expect(response.headers["X-Content-Type-Options"]).to eq("nosniff")
    expect(response.body).to eq("hello")
  end

  it "does not download an attachment index that is not present" do
    authenticate
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}/source")
      .to_return(status: 200, body: attachment_source, headers: { "Content-Type" => "text/plain" })

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/#{message_id}/attachments/1"

    expect(response).to have_http_status(:not_found)
  end

  it "deletes a message" do
    user = authenticate
    MessageRead.record(user:, mailbox:, message_id:)
    stub_request(:delete, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/#{message_id}")
      .to_return(status: 200, body: '"OK"', headers: { "Content-Type" => "application/json" })

    delete "/v1/inbucket/message", params: { name: mailbox, id: message_id }

    expect(response).to have_http_status(:no_content)
    expect(MessageRead.where(user:, mailbox:, message_id:).count).to eq(0)
  end

  it "purges a mailbox and removes it from saved mailboxes" do
    user = authenticate
    Mailbox.record(mailbox)
    MessageRead.record(user:, mailbox:, message_id:)
    stub_request(:delete, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}")
      .to_return(status: 200, body: '"OK"', headers: { "Content-Type" => "application/json" })

    delete "/v1/inbucket/mailbox", params: { name: mailbox }

    expect(response).to have_http_status(:no_content)
    expect(Mailbox.find_by(name: mailbox)).to be_nil
    expect(MessageRead.where(user:, mailbox:).count).to eq(0)
  end

  it "returns not found when Inbucket cannot find a message" do
    authenticate
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}/missing")
      .to_return(status: 404, body: "not found")

    get "/v1/inbucket/mailboxes/#{mailbox}/messages/missing"

    expect(response).to have_http_status(:not_found)
    expect(response.parsed_body).to eq("error" => "not_found")
  end

  it "reports an unavailable Inbucket service" do
    authenticate
    stub_request(:get, "http://inbucket.test:9000/api/v1/mailbox/#{mailbox}").to_timeout

    get "/v1/inbucket/mailboxes/#{mailbox}"

    expect(response).to have_http_status(:bad_gateway)
    expect(response.parsed_body).to eq("error" => "inbucket_unavailable")
  end

  def authenticate
    user = User.create!(username: "admin", password: "correct horse battery staple")
    post "/v1/session",
         params: { username: user.username, password: "correct horse battery staple" }.to_json,
         headers: json_headers
    expect(response).to have_http_status(:ok)
    user
  end

  def json_headers
    {
      "CONTENT_TYPE" => "application/json"
    }
  end

  def stub_json(path, body)
    stub_request(:get, "http://inbucket.test:9000#{path}")
      .to_return(status: 200, body: body.to_json, headers: { "Content-Type" => "application/json" })
  end

  def attachment_source
    <<~MESSAGE
      Content-Type: multipart/mixed; boundary="part"

      --part
      Content-Type: text/plain

      Welcome
      --part
      Content-Type: application/pdf; name="resume.pdf"
      Content-Disposition: attachment; filename="resume.pdf"
      Content-Transfer-Encoding: base64

      aGVsbG8=
      --part--
    MESSAGE
  end
end
